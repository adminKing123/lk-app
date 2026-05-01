"""
tools/cpu_tool.py — Agent tool: real-time CPU usage.

When the LLM calls ``get_cpu_usage``:
  1. Collects CPU statistics via psutil (runs in a thread to avoid blocking
     the async event loop during the 1-second sampling interval).
  2. Publishes a structured JSON payload to the LiveKit room on the
     ``widget.cpu`` data-channel topic so the frontend can render a live
     visualization.
  3. Returns a plain-text JSON summary for the LLM to explain verbally.
"""

import asyncio
import json
import logging

import psutil
from livekit.agents import function_tool
from livekit.agents.job import get_job_context

logger = logging.getLogger(__name__)


def _gather_cpu_stats() -> dict:
    """
    Blocking helper — intentionally called inside asyncio.to_thread.

    cpu_percent(interval=1.0) blocks for one second while it measures CPU
    activity; running it in a thread keeps the event loop free.
    """
    per_core: list[float] = psutil.cpu_percent(interval=1.0, percpu=True)
    freq = psutil.cpu_freq()

    return {
        "type": "cpu",
        "overall": round(sum(per_core) / len(per_core), 1) if per_core else 0.0,
        "per_core": [round(p, 1) for p in per_core],
        "cpu_count": psutil.cpu_count(logical=True),
        "physical_count": psutil.cpu_count(logical=False),
        "freq_mhz": round(freq.current) if freq else None,
        "freq_max_mhz": round(freq.max) if freq else None,
    }


@function_tool
async def get_cpu_usage() -> str:
    """
    Fetch real-time CPU usage statistics and push them to the user's interface
    for live visualization.

    Call this when the user asks about CPU usage, processor load, system
    performance, or anything related to how busy the computer is.

    After calling this tool, explain the results in plain, friendly language —
    e.g., which cores are busy, whether the system is under heavy load, and
    what the clock frequency means.
    """
    # --- 1. Collect CPU data (non-blocking) ---------------------------------
    data = await asyncio.to_thread(_gather_cpu_stats)
    payload = json.dumps(data).encode("utf-8")

    logger.info(
        "CPU data collected — overall=%.1f%%, cores=%d, freq=%s MHz",
        data["overall"],
        data["cpu_count"],
        data["freq_mhz"],
    )

    # --- 2. Publish to frontend via LiveKit data channel --------------------
    try:
        job_ctx = get_job_context()
        await job_ctx.room.local_participant.publish_data(
            payload,
            reliable=True,
            topic="widget.cpu",
        )
        logger.debug("CPU payload published to frontend on topic 'widget.cpu'")
    except Exception as exc:  # noqa: BLE001
        # Don't let a publish failure break the agent's verbal reply
        logger.warning("Failed to publish CPU data to frontend: %s", exc)

    # --- 3. Return JSON summary for the LLM to verbalise -------------------
    return json.dumps(data)
