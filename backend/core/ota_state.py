"""Shared OTA update progress marker.

The marker lets the ``/health`` endpoint report ``updating`` while an OTA
update is running, even across the backend container restart that the update
itself triggers. Two independent signals end the ``updating`` state:

* the running backend already matches the target version (update applied), or
* the OTA script finished and removed the marker, or
* a safety TTL elapsed (so a crashed update can never wedge the UI forever).
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

from core.version import get_current_version, normalize_tag

logger = logging.getLogger(__name__)

MARKER_FILENAME = ".ota_updating"
# Safety valve: ignore (and clean up) a marker older than this.
MARKER_TTL_SEC = 15 * 60


def _marker_path(install_dir: str) -> Path:
    return Path(install_dir) / MARKER_FILENAME


def mark_update_started(install_dir: str, target_tag: str) -> None:
    """Record that an update toward ``target_tag`` has started."""
    path = _marker_path(install_dir)
    try:
        path.write_text(f"{target_tag}\n{int(time.time())}", encoding="utf-8")
    except OSError:
        logger.exception("Failed to write OTA update marker at %s", path)


def clear_update_marker(install_dir: str) -> None:
    try:
        _marker_path(install_dir).unlink(missing_ok=True)
    except OSError:
        logger.exception("Failed to remove OTA update marker")


def is_update_in_progress(install_dir: str) -> bool:
    """Return ``True`` while an OTA update is still in flight."""
    path = _marker_path(install_dir)
    try:
        raw = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return False
    except OSError:
        logger.exception("Failed to read OTA update marker")
        return False

    target_tag, _, started_raw = raw.partition("\n")
    target_tag = target_tag.strip()
    try:
        started_at = int(started_raw.strip())
    except ValueError:
        started_at = 0

    # Update is done once the running backend already serves the target version.
    if target_tag and normalize_tag(target_tag) == get_current_version():
        clear_update_marker(install_dir)
        return False

    if started_at and time.time() - started_at > MARKER_TTL_SEC:
        clear_update_marker(install_dir)
        return False

    return True
