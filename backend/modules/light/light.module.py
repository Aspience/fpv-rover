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
        self._auto_night_mode_enabled = False
        self._night_mode_threshold = config.NIGHT_MODE_LUX_THRESHOLD
        self._night_mode_active: bool | None = None
        logger.info(
            "Light module ready (BH1750 @ 0x%02x)",
            self.settings.light_i2c_address,
        )
        self._command_task = asyncio.create_task(
            self._watch_commands(self.event_bus.subscribe(Topics.COMMAND_LIGHT))
        )
        self._auto_night_task = asyncio.create_task(
            self._watch_auto_night(
                self.event_bus.subscribe(Topics.COMMAND_LIGHT_AUTO_NIGHT)
            )
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
        if self._auto_night_mode_enabled:
            await self._apply_auto_night_mode(lux)
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        for task_name in ("_command_task", "_auto_night_task"):
            if hasattr(self, task_name):
                task = getattr(self, task_name)
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        logger.info("Light module cleanup")

    async def _watch_commands(self, stream: object) -> None:
        async for payload in stream:  # type: ignore[union-attr]
            level = int(payload.get("level", 0))
            set_brightness(level)

    async def _watch_auto_night(self, stream: object) -> None:
        async for payload in stream:  # type: ignore[union-attr]
            self._auto_night_mode_enabled = bool(payload.get("enabled", False))
            self._night_mode_threshold = float(
                payload.get("threshold_lux", config.NIGHT_MODE_LUX_THRESHOLD)
            )
            logger.info(
                "Auto night mode %s (threshold %.1f lux)",
                "enabled" if self._auto_night_mode_enabled else "disabled",
                self._night_mode_threshold,
            )
            if not self._auto_night_mode_enabled:
                await self._publish_night_mode_if_changed(False)
            else:
                await self._read_and_apply_auto_night_mode()

    async def _apply_auto_night_mode(self, lux: float) -> None:
        enabled = lux < self._night_mode_threshold
        await self._publish_night_mode_if_changed(enabled, lux)

    async def _read_and_apply_auto_night_mode(self) -> None:
        lux = await asyncio.to_thread(
            read_lux,
            self.settings.i2c_bus,
            self.settings.light_i2c_address,
        )
        await self._apply_auto_night_mode(lux)

    async def _publish_night_mode_if_changed(
        self,
        enabled: bool,
        lux: float | None = None,
    ) -> None:
        if enabled == self._night_mode_active:
            return
        self._night_mode_active = enabled
        payload: dict[str, bool | float] = {"enabled": enabled}
        if lux is not None:
            payload["lux"] = lux
        await self.event_bus.publish(Topics.CAMERA_NIGHT_MODE, payload)
