"""
lkaiv2 — LiveKit AI Voice Agent
================================
Stack:
  • LLM      : Google Gemini 2.5 Flash  (via livekit-plugins-google)
  • STT      : ElevenLabs Scribe v2     (via livekit-plugins-elevenlabs)
  • TTS      : ElevenLabs Turbo v2.5   (via livekit-plugins-elevenlabs)
  • Avatar   : HeyGen LiveAvatar        (via livekit-plugins-liveavatar)
  • VAD      : Silero                   (via livekit-agents[silero])
  • Noise    : ai-coustics              (via livekit-plugins-ai-coustics)
  • Turns    : MultilingualModel        (via livekit-agents[turn-detector])

Usage:
  uv run src/agent.py download-files   # one-time model download
  uv run src/agent.py console          # local terminal test
  uv run src/agent.py dev              # connect to LiveKit Cloud (dev mode)
  uv run src/agent.py start            # production mode
"""

import os
import json
import logging
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, room_io, TurnHandlingOptions
from livekit.plugins import (
    ai_coustics,
    elevenlabs,
    google,
    liveavatar,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

# Load environment variables from .env (fallback to system env)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------

class Assistant(Agent):
    """
    Conversational AI assistant powered by Gemini, ElevenLabs, and LiveAvatar.

    Override this class to customise the agent's persona, add function tools,
    implement multi-agent handoffs, or change the RAG strategy.
    """

    def __init__(self, name_context: str = "") -> None:
        # Append participant-name context to the base instructions when available.
        base = (
            "You are Max, a capable and friendly AI assistant. "
            "Your goal is to help users with any task they have — "
            "answering questions, explaining concepts, brainstorming ideas, "
            "writing, coding, research, or general conversation. "
            "Be concise, clear, and conversational. "
            "Speak naturally — no markdown, bullet points, asterisks, or "
            "other formatting, because your responses will be read aloud. "
            "Adapt your tone to the user: professional when they need it, "
            "casual and warm when the conversation calls for it."
        )
        super().__init__(
            instructions=f"{base} {name_context}".strip(),
        )


# ---------------------------------------------------------------------------
# LiveKit Agent Server
# ---------------------------------------------------------------------------

server = AgentServer()


@server.rtc_session(agent_name="lkaiv2-agent")
async def lkaiv2_agent(ctx: agents.JobContext):
    """
    Entry point for each new LiveKit session.

    Flow:
      1. Determine call type (video or voice) from job metadata.
      2. Build AgentSession with STT → LLM → TTS pipeline.
      3. Initialise the LiveAvatar virtual avatar (video calls only).
      4. Start the avatar — it joins the room and publishes video (video only).
      5. Start the agent session — begins listening for user speech.
      6. Send an opening greeting.
    """

    logger.info("New agent job received — room: %s", ctx.room.name)

    # ------------------------------------------------------------------
    # 1. Determine call type and participant name from job metadata
    # ------------------------------------------------------------------
    call_type = "video"        # default: full video+avatar experience
    participant_name = ""      # empty = anonymous / not provided

    if ctx.job.metadata:
        try:
            meta = json.loads(ctx.job.metadata)
            call_type = meta.get("call_type", "video")
            participant_name = meta.get("participant_name", "").strip()
        except (json.JSONDecodeError, AttributeError):
            pass  # Malformed metadata — fall back to defaults

    use_avatar = call_type == "video"
    logger.info(
        "Call type: %s | LiveAvatar: %s | Participant: %s",
        call_type, use_avatar, participant_name or "<anonymous>",
    )

    # ------------------------------------------------------------------
    # 2. Build the STT → LLM → TTS pipeline
    # ------------------------------------------------------------------
    # Include the participant's name in the system instructions so the LLM
    # can address them naturally throughout the conversation.
    name_context = (
        f"The user's name is {participant_name}. "
        "Address them by name naturally — not in every reply, just when it feels right."
    ) if participant_name else ""

    session = AgentSession(
        # Speech-to-Text: ElevenLabs Scribe v2 Realtime (90+ languages)
        stt=elevenlabs.STT(
            model_id="scribe_v2_realtime",
        ),

        # Large Language Model: Google Gemini 2.5 Flash (low-latency)
        llm=google.LLM(
            model="gemini-2.5-flash",
        ),

        # Text-to-Speech: ElevenLabs Turbo v2.5 (low-latency, multilingual)
        tts=elevenlabs.TTS(
            # ElevenLabs voice ID — override via ELEVENLABS_VOICE_ID env var
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL"),
            model="eleven_turbo_v2_5",
        ),

        # Voice-Activity Detection: Silero (lightweight, offline)
        vad=silero.VAD.load(),

        # Turn-end detection: multilingual contextual model
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
        ),
    )

    # ------------------------------------------------------------------
    # 3. Initialise the LiveAvatar virtual avatar (video calls only)
    # ------------------------------------------------------------------
    avatar_id = os.environ.get("LIVEAVATAR_AVATAR_ID", "")
    if use_avatar and avatar_id:
        avatar = liveavatar.AvatarSession(
            avatar_id=avatar_id,
        )
    elif use_avatar and not avatar_id:
        logger.warning(
            "LIVEAVATAR_AVATAR_ID is not set — the avatar session will be "
            "skipped. Set the variable in .env to enable the virtual avatar."
        )
        avatar = None
    else:
        # Voice call — intentionally skip avatar to save cost and latency
        logger.info("Voice call mode — skipping LiveAvatar session.")
        avatar = None

    # ------------------------------------------------------------------
    # 4. Start the avatar — it joins the room and begins publishing video
    # ------------------------------------------------------------------
    if avatar is not None:
        await avatar.start(session, room=ctx.room)
        logger.info("LiveAvatar session started (avatar_id=%s)", avatar_id)

    # ------------------------------------------------------------------
    # 5. Start the agent session — begins listening for user speech
    # ------------------------------------------------------------------
    await session.start(
        room=ctx.room,
        agent=Assistant(name_context=name_context),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                # ai-coustics background-noise cancellation
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_L,
                ),
            ),
        ),
    )

    # ------------------------------------------------------------------
    # 6. Send an opening greeting to the user
    # ------------------------------------------------------------------
    if participant_name:
        greeting_prompt = (
            f"Greet the user by their name ({participant_name}), "
            "introduce yourself as Max, and ask how you can help them today."
        )
    else:
        greeting_prompt = (
            "Greet the user warmly, introduce yourself as Max, "
            "and ask how you can help them today."
        )

    await session.generate_reply(instructions=greeting_prompt)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    agents.cli.run_app(server)
