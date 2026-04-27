"""
lkaiv2 — LiveKit AI Voice Agent  (entry point / orchestrator)
==============================================================
Stack:
  • LLM      : Google Gemini 2.5 Flash  (via livekit-plugins-google)
  • STT      : ElevenLabs Scribe v2     (via livekit-plugins-elevenlabs)
  • TTS      : ElevenLabs Turbo v2.5   (via livekit-plugins-elevenlabs)
  • Avatar   : HeyGen LiveAvatar        (via livekit-plugins-liveavatar)
  • VAD      : Silero                   (via livekit-agents[silero])
  • Noise    : ai-coustics              (via livekit-plugins-ai-coustics)
  • Turns    : MultilingualModel        (via livekit-agents[turn-detector])

Module layout
  config.py    — shared constants (LANGUAGE_NAMES, defaults)
  assistant.py — Assistant(Agent) class and persona instructions
  handlers.py  — session event callbacks (handle_text, …)
  utils.py     — pure helpers: metadata parsing, context/greeting builders
  agent.py     — this file: AgentServer wiring + session entry point

Usage:
  uv run src/agent.py download-files   # one-time model download
  uv run src/agent.py console          # local terminal test
  uv run src/agent.py dev              # connect to LiveKit Cloud (dev mode)
  uv run src/agent.py start            # production mode
"""

import os
import logging

from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, room_io, TurnHandlingOptions
from livekit.plugins import ai_coustics, elevenlabs, google, liveavatar, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# Local modules
from assistant import Assistant
from config import AGENT_NAME, DEFAULT_VOICE_ID
from handlers import handle_text
from utils import (
    parse_job_metadata,
    build_name_context,
    build_language_context,
    build_greeting_prompt,
)

# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

# Load environment variables from .env (fallback to system env)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LiveKit Agent Server
# ---------------------------------------------------------------------------

server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def lkaiv2_agent(ctx: agents.JobContext):
    """
    Entry point called by the LiveKit runtime for each new room session.

    Flow:
      1. Parse job metadata → call_type, participant_name, language.
      2. Build per-session system-instruction context strings.
      3. Construct the STT → LLM → TTS AgentSession pipeline.
      4. Initialise and start the LiveAvatar (video calls only).
      5. Start the agent session — begins listening for user speech/text.
      6. Send a personalised opening greeting.
    """

    logger.info("New agent job received — room: %s", ctx.room.name)

    # ------------------------------------------------------------------
    # 1. Parse job metadata
    # ------------------------------------------------------------------
    call_type, participant_name, language = parse_job_metadata(ctx.job.metadata)
    use_avatar = call_type == "video"

    logger.info(
        "Call type: %s | LiveAvatar: %s | Participant: %s | Language: %s",
        call_type, use_avatar, participant_name or "<anonymous>", language,
    )

    # ------------------------------------------------------------------
    # 2. Build per-session context strings
    # ------------------------------------------------------------------
    name_context = build_name_context(participant_name)
    language_context = build_language_context(language)

    # ------------------------------------------------------------------
    # 3. Build the STT → LLM → TTS pipeline
    # ------------------------------------------------------------------
    session = AgentSession(
        # Speech-to-Text: ElevenLabs Scribe v2 Realtime (90+ languages)
        stt=elevenlabs.STT(model_id="scribe_v2_realtime"),

        # Large Language Model: Google Gemini 2.5 Flash (low-latency)
        llm=google.LLM(model="gemini-2.5-flash"),

        # Text-to-Speech: ElevenLabs Turbo v2.5 (low-latency, multilingual)
        tts=elevenlabs.TTS(
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID),
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
    # 4. Initialise and start LiveAvatar (video calls only)
    # ------------------------------------------------------------------
    avatar_id = os.environ.get("LIVEAVATAR_AVATAR_ID", "")

    if use_avatar and avatar_id:
        avatar = liveavatar.AvatarSession(avatar_id=avatar_id)
    elif use_avatar and not avatar_id:
        logger.warning(
            "LIVEAVATAR_AVATAR_ID is not set — avatar session will be skipped. "
            "Set the variable in .env to enable the virtual avatar."
        )
        avatar = None
    else:
        # Voice call — intentionally skip avatar to save cost and latency
        logger.info("Voice call mode — skipping LiveAvatar session.")
        avatar = None

    if avatar is not None:
        await avatar.start(session, room=ctx.room)
        logger.info("LiveAvatar session started (avatar_id=%s)", avatar_id)

    # ------------------------------------------------------------------
    # 5. Start the agent session
    # ------------------------------------------------------------------
    await session.start(
        room=ctx.room,
        agent=Assistant(name_context=name_context, language_context=language_context),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                # ai-coustics background-noise cancellation
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_L,
                ),
            ),
            # Handle text messages sent by the user via the in-call chat panel
            text_input=room_io.TextInputOptions(
                text_input_cb=handle_text,
            ),
        ),
    )

    # ------------------------------------------------------------------
    # 6. Send a personalised opening greeting
    # ------------------------------------------------------------------
    await session.generate_reply(
        instructions=build_greeting_prompt(participant_name, language),
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    agents.cli.run_app(server)
