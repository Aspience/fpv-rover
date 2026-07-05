"""Post-init tasks run after all modules have started."""

from __future__ import annotations

import logging

from core.config import Settings, Topics
from core.event_bus import EventBus

logger = logging.getLogger(__name__)


async def run_post_init(event_bus: EventBus, settings: Settings) -> None:
    if not settings.modules_motion_enabled:
        return
    logger.info("Publishing startup steering calibration")
    await event_bus.publish(Topics.COMMAND_CALIBRATE, {"source": "startup"})
