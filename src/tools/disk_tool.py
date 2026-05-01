"""
tools/disk_tool.py — Agent tool: real-time disk usage.

When the LLM calls ``get_disk_usage``:
  1. Collects per-partition disk statistics via psutil (non-blocking thread).
  2. Publishes a structured JSON payload to the LiveKit room on the
     ``widget.disk`` data-channel topic so the frontend can render it.
  3. Returns a plain-text JSON summary for the LLM to explain verbally.
"""

import asyncio
import json
import logging

import psutil
from livekit.agents import function_tool
from livekit.agents.job import get_job_context

logger = logging.getLogger(__name__)

# Partitions mounted at these prefixes are typically virtual/system filesystems
# and are not useful to the user; filter them out for clarity.
_SKIP_FSTYPES = frozenset({
    "squashfs", "tmpfs", "devtmpfs", "sysfs", "proc", "cgroup",
    "cgroup2", "pstore", "debugfs", "tracefs", "overlay",
})


def _gather_disk_stats() -> dict:
    """
    Blocking helper — called inside asyncio.to_thread.

    Iterates physical disk partitions, collects usage per mountpoint, and
    aggregates a combined total across all included partitions.
    """
    partitions = []
    total_total = total_used = total_free = 0

    for part in psutil.disk_partitions(all=False):
        if part.fstype in _SKIP_FSTYPES:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except PermissionError:
            continue  # Inaccessible mount (e.g. CD-ROM with no disc)

        total_gb = round(usage.total / 1024 ** 3, 2)
        used_gb  = round(usage.used  / 1024 ** 3, 2)
        free_gb  = round(usage.free  / 1024 ** 3, 2)

        partitions.append({
            "mountpoint": part.mountpoint,
            "device":     part.device,
            "fstype":     part.fstype,
            "total_gb":   total_gb,
            "used_gb":    used_gb,
            "free_gb":    free_gb,
            "percent":    round(usage.percent, 1),
        })

        total_total += usage.total
        total_used  += usage.used
        total_free  += usage.free

    overall_pct = round(total_used / total_total * 100, 1) if total_total else 0.0

    return {
        "type":            "disk",
        "partitions":      partitions,
        "total_gb":        round(total_total / 1024 ** 3, 2),
        "used_gb":         round(total_used  / 1024 ** 3, 2),
        "free_gb":         round(total_free  / 1024 ** 3, 2),
        "overall_percent": overall_pct,
    }


@function_tool
async def get_disk_usage() -> str:
    """
    Fetch real-time disk usage statistics and push them to the user's interface
    for live visualization.

    Call this when the user asks about disk space, storage usage, how full
    their hard drive or SSD is, or anything related to available storage.

    After calling this tool, explain the results in plain, friendly language —
    e.g., which partitions are nearly full, how much free space is left, and
    what the filesystem type means if relevant.
    """
    # --- 1. Collect disk data (non-blocking) --------------------------------
    data = await asyncio.to_thread(_gather_disk_stats)
    payload = json.dumps(data).encode("utf-8")

    logger.info(
        "Disk data collected — overall=%.1f%%, partitions=%d, total=%.1f GB",
        data["overall_percent"],
        len(data["partitions"]),
        data["total_gb"],
    )

    # --- 2. Publish to frontend via LiveKit data channel --------------------
    try:
        job_ctx = get_job_context()
        await job_ctx.room.local_participant.publish_data(
            payload,
            reliable=True,
            topic="widget.disk",
        )
        logger.debug("Disk payload published to frontend on topic 'widget.disk'")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to publish disk data to frontend: %s", exc)

    # --- 3. Return JSON summary for the LLM to verbalise -------------------
    return json.dumps(data)
