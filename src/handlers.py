"""
lkaiv2 — Agent session event handlers.

Houses all callback functions that are registered with the AgentSession at
startup.  Keeping handlers in their own module makes them trivial to unit-test
and easy to extend (e.g. adding a ``handle_data_message`` later).
"""

from livekit.agents import AgentSession, room_io


def handle_text(session: AgentSession, event: room_io.TextInputEvent) -> None:
    """
    Handle a text message sent by the user via the in-call chat input.

    Called automatically by the agent runtime whenever the frontend sends a
    message on the ``lk.chat`` topic.  Interrupts any ongoing spoken response
    first so the agent can pivot cleanly to the typed question.

    Args:
        session: The active ``AgentSession`` for this room.
        event:   The incoming text event containing the user's message.
    """
    message = event.text.strip()
    if not message:
        return

    # Stop any ongoing spoken response before generating the new reply.
    session.interrupt()
    session.generate_reply(user_input=message)
