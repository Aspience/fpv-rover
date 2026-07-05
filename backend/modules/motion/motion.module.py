"""Motion module lifecycle."""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.motion import config
from modules.motion.hardware import init_motion_hardware
from modules.motion.schema import MotionData
from modules.motion.service import (
    apply_control,
    calibrate_steering,
    calibration_error,
    is_calibrating,
    steer_deg_applied,
    stop_all,
    throttle_applied,
    ticks_to_deg,
)

logger = logging.getLogger(__name__)


class MotionModule(BaseHardwareModule):
    name = "motion"

    def __init__(self, event_bus, settings) -> None:  # noqa: ANN001
        super().__init__(event_bus, settings)
        self._hw = init_motion_hardware(settings)
        self._calibrate_task: asyncio.Task[None] | None = None
        self._event_tasks: list[asyncio.Task[None]] = []

    async def setup(self) -> None:
        await self._hw.start()
        self._event_tasks = [
            asyncio.create_task(
                self._watch_commands(self.event_bus.subscribe(Topics.COMMAND_CONTROL))
            ),
            asyncio.create_task(
                self._watch_calibrate(
                    self.event_bus.subscribe(Topics.COMMAND_CALIBRATE)
                )
            ),
            asyncio.create_task(
                self._watch_estop(self.event_bus.subscribe(Topics.SYSTEM_EMERGENCY_STOP))
            ),
        ]
        logger.info("Motion module ready (mock=%s)", self._hw.mock)

    async def loop(self) -> None:
        steer = self._hw.steer
        data = MotionData(
            steering_pos=int(ticks_to_deg(steer.position)),
            throttle_applied=throttle_applied(),
            steer_deg_applied=steer_deg_applied(),
            calibrating=is_calibrating(),
            calibration_error=calibration_error(),
            front_speed=self._hw.front.speed,
            rear_speed=self._hw.rear.speed,
        )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}motion",
            {"module": "motion", "data": data.model_dump()},
        )
        await asyncio.sleep(config.TELEMETRY_INTERVAL_SEC)

    async def cleanup(self) -> None:
        for task in self._event_tasks:
            task.cancel()
        for task in self._event_tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._event_tasks.clear()
        if self._calibrate_task:
            self._calibrate_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._calibrate_task
        stop_all(self._hw)
        await self._hw.stop()
        logger.info("Motion module cleanup")

    async def _watch_commands(self, stream: object) -> None:
        async for payload in stream:  # type: ignore[union-attr]
            throttle = int(payload.get("throttle", 0))
            steer_deg = float(payload.get("steer_deg", 0.0))
            apply_control(self._hw, throttle, steer_deg, self.settings)

    async def _watch_calibrate(self, stream: object) -> None:
        async for _payload in stream:  # type: ignore[union-attr]
            if self._calibrate_task and not self._calibrate_task.done():
                continue
            self._calibrate_task = asyncio.create_task(
                calibrate_steering(self._hw, self.settings)
            )

    async def _watch_estop(self, stream: object) -> None:
        async for _payload in stream:  # type: ignore[union-attr]
            stop_all(self._hw)
