# lkaiv2 — Backend

Python LiveKit AI agent using **Gemini 2.5 Flash** (LLM), **ElevenLabs Scribe v2** (STT), **ElevenLabs Turbo v2.5** (TTS), and **LiveAvatar** virtual avatar.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | ≥ 3.10 | [python.org](https://python.org) |
| uv | latest | `pip install uv` or [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) |
| LiveKit Cloud account | — | [cloud.livekit.io](https://cloud.livekit.io) (free) |

---

## Setup

### 1. Create the virtual environment and install dependencies

```bash
cd backend
uv venv .venv          # creates .venv/
uv sync                # installs all dependencies from pyproject.toml
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Open .env and fill in all required values (see comments inside the file)
```

Required keys:

| Variable | Where to get it |
|----------|----------------|
| `LIVEKIT_URL` | LiveKit Cloud → Project → Settings |
| `LIVEKIT_API_KEY` | LiveKit Cloud → Project → Settings |
| `LIVEKIT_API_SECRET` | LiveKit Cloud → Project → Settings |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `ELEVEN_API_KEY` | [ElevenLabs Settings](https://elevenlabs.io/app/settings/api-keys) |
| `LIVEAVATAR_API_KEY` | [LiveAvatar docs](https://docs.liveavatar.com/docs/api-key-configuration) |
| `LIVEAVATAR_AVATAR_ID` | [LiveAvatar Dashboard](https://app.liveavatar.com/home) |

### 3. Download required model files (one-time)

```bash
uv run src/agent.py download-files
```

---

## Running

You need **two** processes running simultaneously:

### Terminal 1 — AI Agent

```bash
# Development mode (connects to LiveKit Cloud, hot-reload on file changes)
uv run src/agent.py dev

# Local terminal test (speak to the agent directly in your terminal)
uv run src/agent.py console

# Production mode
uv run src/agent.py start
```

### Terminal 2 — Token Server

```bash
uv run uvicorn src.token_server:app --reload --host 0.0.0.0 --port 8000
```

The token server exposes:
- `GET  /health` — health check
- `POST /token`  — issues a LiveKit JWT + dispatches the agent

---

## Architecture

```
User browser
    │ WebRTC (audio/video)
    ▼
LiveKit Cloud ────────────────────────────────────────────┐
    │                                                      │
    │ Job dispatch                                         │
    ▼                                                      │
Agent (src/agent.py)                                      │
  ├─ ElevenLabs STT  ← user audio                        │
  ├─ Google Gemini   ← transcript                        │
  ├─ ElevenLabs TTS  ← LLM response text                 │
  └─ LiveAvatar      → publishes avatar video to room ───┘
```

---

## Project Structure

```
backend/
├── src/
│   ├── __init__.py         # Package marker
│   ├── agent.py            # LiveKit AI agent (main entry point)
│   └── token_server.py     # FastAPI token + dispatch service
├── .env                    # Your secrets (git-ignored)
├── .env.example            # Template — copy to .env
├── pyproject.toml          # uv project config + dependencies
└── README.md               # This file
```
