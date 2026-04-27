"""
lkaiv2 — Utility helpers for metadata parsing and context building.

Pure functions with no side effects — easy to unit-test independently of the
LiveKit runtime.  Each helper has a single, clearly scoped responsibility.
"""

import json

from config import DEFAULT_CALL_TYPE, DEFAULT_LANGUAGE, LANGUAGE_NAMES


# ---------------------------------------------------------------------------
# Metadata parsing
# ---------------------------------------------------------------------------

def parse_job_metadata(metadata: str | None) -> tuple[str, str, str]:
    """
    Parse raw job-metadata JSON into ``(call_type, participant_name, language)``.

    Falls back to safe defaults when the metadata string is absent, empty,
    or contains malformed JSON.

    Args:
        metadata: Raw JSON string from ``ctx.job.metadata``, or ``None``.

    Returns:
        A three-tuple ``(call_type, participant_name, language)``.
    """
    call_type = DEFAULT_CALL_TYPE
    participant_name = ""
    language = DEFAULT_LANGUAGE

    if metadata:
        try:
            meta = json.loads(metadata)
            call_type = meta.get("call_type", DEFAULT_CALL_TYPE)
            participant_name = meta.get("participant_name", "").strip()
            language = meta.get("language", DEFAULT_LANGUAGE).strip() or DEFAULT_LANGUAGE
        except (json.JSONDecodeError, AttributeError):
            pass  # Malformed metadata — fall back to defaults

    return call_type, participant_name, language


# ---------------------------------------------------------------------------
# System-instruction context builders
# ---------------------------------------------------------------------------

def build_name_context(participant_name: str) -> str:
    """
    Return a system-instruction snippet for personalising responses by name.

    Returns an empty string when no name is available so callers can safely
    ``filter(None, ...)`` over the result.

    Args:
        participant_name: The participant's display name, or an empty string.
    """
    if not participant_name:
        return ""
    return (
        f"The user's name is {participant_name}. "
        "Address them by name naturally — not in every reply, just when it feels right."
    )


def build_language_context(language: str) -> str:
    """
    Return a system-instruction snippet for enforcing the chosen language.

    Returns an empty string for the default language (English) so that English
    sessions receive no unnecessary instruction noise.

    Args:
        language: BCP-47 language code (e.g. ``"es"``, ``"zh"``).
    """
    if language == DEFAULT_LANGUAGE:
        return ""
    language_name = LANGUAGE_NAMES.get(language, language)
    return (
        f"IMPORTANT: Always respond exclusively in {language_name}. "
        "Do not switch to any other language regardless of what the user says, "
        "unless they explicitly ask you to change languages."
    )


# ---------------------------------------------------------------------------
# Greeting prompt builder
# ---------------------------------------------------------------------------

def build_greeting_prompt(participant_name: str, language: str) -> str:
    """
    Build the ``instructions`` string passed to ``session.generate_reply()``
    for the opening greeting.

    Args:
        participant_name: The participant's display name, or an empty string.
        language:         BCP-47 language code for the session.
    """
    language_name = LANGUAGE_NAMES.get(language, language)
    lang_instruction = (
        f" Greet them in {language_name}." if language != DEFAULT_LANGUAGE else ""
    )

    if participant_name:
        return (
            f"Greet the user by their name ({participant_name}), "
            f"introduce yourself as Max, and ask how you can help them today."
            f"{lang_instruction}"
        )

    return (
        f"Greet the user warmly, introduce yourself as Max, "
        f"and ask how you can help them today.{lang_instruction}"
    )
