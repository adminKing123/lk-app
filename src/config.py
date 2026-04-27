"""
lkaiv2 — Shared configuration constants.

Centralises all agent defaults and lookup tables so they can be imported
by agent.py, utils.py, and any future modules without duplication.
"""

# ---------------------------------------------------------------------------
# Agent defaults
# ---------------------------------------------------------------------------

# Name shown to participants in the room
AGENT_NAME: str = "lkaiv2-agent"

# ElevenLabs voice used when ELEVENLABS_VOICE_ID env var is not set
DEFAULT_VOICE_ID: str = "EXAVITQu4vr4xnSDxMaL"

# Default values when job metadata is absent or malformed
DEFAULT_CALL_TYPE: str = "video"
DEFAULT_LANGUAGE: str = "en"


# ---------------------------------------------------------------------------
# Language name lookup
# ---------------------------------------------------------------------------

# Maps BCP-47 language codes (as accepted by the /token endpoint) to the
# plain English language names used inside system instructions and greeting
# prompts.  Add entries here to support new languages end-to-end.
LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "hi": "Hindi",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "ar": "Arabic",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ru": "Russian",
    "it": "Italian",
    "nl": "Dutch",
    "tr": "Turkish",
    "id": "Indonesian",
}
