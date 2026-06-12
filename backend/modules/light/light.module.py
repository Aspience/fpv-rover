from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.light import config
from modules.light.utils import read_lux, set_brightness

logger = logging.getLogger(__name__)


class LightModule(BaseHardwareModule):
    name = "light"

    async def setup(self) -> None:
        logger.info(
            "Light module ready (BH1750 @ 0x%02x)",
            self.settings.light_i2c_address,
        )
        self._command_task = asyncio.create_task(
            self._watch_commands(self.event_bus.subscribe(Topics.COMMAND_LIGHT))
        )

    async def loop(self) -> None:
        lux = await asyncio.to_thread(
            read_lux,
            self.settings.i2c_bus,
            self.settings.light_i2c_address,
        )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}light",
            {"module": "light", "data": {"lux": lux}},
        )
        if lux < config.NIGHT_MODE_LUX_THRESHOLD:
            await self.event_bus.publish(
                Topics.CAMERA_NIGHT_MODE,
                {"enabled": True, "lux": lux},
            )
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        if hasattr(self, "_command_task"):
            self._command_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._command_task
        logger.info("Light module cleanup")

    async def _watch_commands(self, stream: object) -> None:
        async for payload in stream:  # type: ignore[union-attr]
            level = int(payload.get("level", 0))
            set_brightness(level)
