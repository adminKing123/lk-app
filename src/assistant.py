"""
lkaiv2 — Assistant agent definition.

Defines the ``Assistant`` class that encapsulates the agent's persona and
system instructions.  Keeping this separate from the session entry point
makes it easy to swap personalities, add function tools, or implement
multi-agent handoff patterns without touching the wiring code.
"""

from livekit.agents import Agent


class Assistant(Agent):
    """
    Conversational AI assistant powered by Gemini, ElevenLabs, and LiveAvatar.

    Accepts optional ``name_context`` and ``language_context`` strings that are
    appended to the base persona instructions at runtime, allowing per-session
    personalisation without subclassing.

    Override this class to:
      • Customise the agent's persona or name.
      • Add ``@function_tool``-decorated methods for tool use.
      • Implement multi-agent handoff logic.
    """

    # Base persona shared across all sessions
    _BASE_INSTRUCTIONS: str = (
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

    def __init__(
        self,
        name_context: str = "",
        language_context: str = "",
    ) -> None:
        """
        Build the agent's full system instructions.

        Args:
            name_context:     Instruction snippet that personalises responses
                              with the participant's name (empty = anonymous).
            language_context: Instruction snippet that enforces the chosen
                              language (empty = default English).
        """
        extra = " ".join(filter(None, [language_context, name_context]))
        super().__init__(
            instructions=f"{self._BASE_INSTRUCTIONS} {extra}".strip(),
        )
