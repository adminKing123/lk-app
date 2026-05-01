"""
lkaiv2 — Token & Agent-Dispatch Server
=======================================
A lightweight FastAPI service that:
  1. Generates signed LiveKit access tokens for frontend participants.
  2. Dispatches the lkaiv2-agent to the requested room.

Run standalone (for development):
  uv run uvicorn src.token_server:app --reload --host 0.0.0.0 --port 8000

The agent process (src/agent.py) must be started separately:
  uv run src/agent.py dev

Security note:
  - This server must NOT be exposed publicly without authentication.
  - In production, add user-authentication middleware before calling
    /token so that arbitrary callers cannot obtain room-join tokens.
"""

import os
import uuid
import json
import logging
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from livekit import api as lk_api

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
AGENT_NAME = "lkaiv2-agent"

# Allowed frontend origins (adjust in .env via CORS_ORIGINS as comma-separated URLs)
_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate required env vars on startup."""
    missing = [
        name
        for name, val in [
            ("LIVEKIT_URL", LIVEKIT_URL),
            ("LIVEKIT_API_KEY", LIVEKIT_API_KEY),
            ("LIVEKIT_API_SECRET", LIVEKIT_API_SECRET),
        ]
        if not val
    ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Ensure .env is configured correctly."
        )
    logger.info("Token server starting — LiveKit URL: %s", LIVEKIT_URL)
    yield
    logger.info("Token server shutting down.")


app = FastAPI(
    title="lkaiv2 Token Server",
    description="Issues LiveKit access tokens and dispatches the AI agent.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server and any production frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class TokenRequest(BaseModel):
    """
    Parameters for requesting a LiveKit room token.
    If room_name is omitted, a unique room is created per request.
    If participant_name is omitted, a random identity is generated.
    """

    room_name: str = Field(
        default_factory=lambda: f"room-{uuid.uuid4().hex[:8]}",
        description="Name of the LiveKit room to join.",
    )
    participant_name: str = Field(
        default_factory=lambda: f"user-{uuid.uuid4().hex[:6]}",
        description="Display name / identity of the frontend participant.",
    )
    call_type: Literal["video", "voice"] = Field(
        default="video",
        description="Call type: 'video' enables the LiveAvatar, 'voice' is audio-only.",
    )
    language: str = Field(
        default="en",
        description="BCP-47 language code for the AI to respond in (e.g. 'en', 'hi', 'es').",
        max_length=10,
    )


class TokenResponse(BaseModel):
    token: str = Field(description="Signed LiveKit JWT access token.")
    room_name: str = Field(description="Room the participant will join.")
    livekit_url: str = Field(description="LiveKit server WebSocket URL.")


# ---------------------------------------------------------------------------
# Helper: generate an access token
# ---------------------------------------------------------------------------

def _build_access_token(room_name: str, participant_name: str) -> str:
    """
    Create a short-lived LiveKit access token granting room-join rights.

    TTL is 1 hour by default — adjust for your security requirements.
    """
    token = (
        lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_grants(
            lk_api.VideoGrants(
                room_join=True,
                room=room_name,
            )
        )
        .with_identity(participant_name)
        .with_name(participant_name)
        .with_ttl(timedelta(hours=1))  # timedelta required, not bare int
        .to_jwt()
    )
    return token


# ---------------------------------------------------------------------------
# Helper: dispatch the agent to the room
# ---------------------------------------------------------------------------

async def _dispatch_agent(room_name: str, call_type: str = "video", participant_name: str = "", language: str = "en") -> None:
    """
    Ask the LiveKit server to send a job to the lkaiv2-agent worker
    for the given room.  The agent worker must already be running
    (started via `uv run src/agent.py dev`).

    call_type, participant_name, and language are forwarded as JSON metadata
    so the agent can skip the LiveAvatar session for voice calls, personalise
    the greeting, and respond in the user's chosen language.
    """
    lk = lk_api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )
    try:
        await lk.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name=AGENT_NAME,
                room=room_name,
                metadata=json.dumps({
                    "call_type": call_type,
                    "participant_name": participant_name,
                    "language": language,
                }),
            )
        )
        logger.info(
            "Agent '%s' dispatched to room '%s' (call_type=%s, participant=%s, language=%s).",
            AGENT_NAME, room_name, call_type, participant_name or "<anonymous>", language,
        )
    except Exception as exc:
        # Log but don't fail the token request — agent may auto-dispatch
        logger.warning("Agent dispatch failed (will rely on auto-dispatch): %s", exc)
    finally:
        await lk.aclose()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", summary="Health check")
async def health_check():
    """Returns 200 OK when the server is running."""
    return {"status": "ok"}


@app.post(
    "/token",
    response_model=TokenResponse,
    summary="Issue a LiveKit token and dispatch the AI agent",
)
async def issue_token(body: TokenRequest) -> TokenResponse:
    """
    1. Generate a signed LiveKit access token for the participant.
    2. Dispatch the lkaiv2-agent to the room.
    3. Return the token + room info to the frontend.
    """
    try:
        token = _build_access_token(body.room_name, body.participant_name)
    except Exception as exc:
        logger.error("Token generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to generate token.")

    # Dispatch the agent asynchronously — do not block the response
    await _dispatch_agent(body.room_name, body.call_type, body.participant_name, body.language)

    return TokenResponse(
        token=token,
        room_name=body.room_name,
        livekit_url=LIVEKIT_URL,
    )

app.mount(
    "/client/assets",
    StaticFiles(directory=DIST_DIR / "assets"),
    name="assets",
)

@app.get("/client")
@app.get("/client/")
async def serve_spa_root():
    return FileResponse(DIST_DIR / "index.html")

@app.get("/client/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = DIST_DIR / full_path

    # If file exists (like .js, .css), serve it
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)

    # Otherwise fallback to React app
    return FileResponse(DIST_DIR / "index.html")
