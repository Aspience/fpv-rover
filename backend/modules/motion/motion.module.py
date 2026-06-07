from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from typing import Any

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.motion.utils import calibrate_steering, get_steering_position, set_pwm

logger = logging.getLogger(__name__)


class MotionModule(BaseHardwareModule):
    name = "motion"

    async def setup(self) -> None:
        await calibrate_steering()
        self._estop_task = asyncio.create_task(
            self._watch_emergency_stop(
                self.event_bus.subscribe(Topics.SYSTEM_EMERGENCY_STOP)
            )
        )
        self._control_task = asyncio.create_task(
            self._watch_control(self.event_bus.subscribe(Topics.COMMAND_CONTROL))
        )

    async def loop(self) -> None:
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}motion",
            {
                "module": "motion",
                "data": {"steering_pos": get_steering_position()},
            },
        )
        await asyncio.sleep(0.05)

    async def cleanup(self) -> None:
        set_pwm(0.0, 0.0, 0.0)
        for task_name in ("_estop_task", "_control_task"):
            if hasattr(self, task_name):
                task = getattr(self, task_name)
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        logger.info("Motion module cleanup")

    async def _watch_emergency_stop(self, stream: object) -> None:
        async for _payload in stream:  # type: ignore[union-attr]
            set_pwm(0.0, 0.0, 0.0)
            logger.warning("Emergency stop: motors halted")

    async def _watch_control(self, stream: object) -> None:
        async for payload in stream:  # type: ignore[union-attr]
            await self._apply_control(payload)

    async def _apply_control(self, payload: dict[str, Any]) -> None:
        left = float(payload.get("pwm_left", 0)) / 100.0
        right = float(payload.get("pwm_right", 0)) / 100.0
        steer = float(payload.get("steer", 0.0))
        set_pwm(left, right, steer)
