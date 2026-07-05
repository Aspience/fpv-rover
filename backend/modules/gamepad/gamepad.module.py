"""Gamepad input module."""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from enum import Enum

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.gamepad import config
from modules.gamepad.schema import GamepadData
from modules.gamepad.utils import find_gamepad_device, is_device_present, read_gamepad_input
from modules.motion.control import ThrottleArbiter, dispatch_control, resolve_throttle

logger = logging.getLogger(__name__)


class _State(Enum):
    SCANNING = "scanning"
    ACTIVE = "active"


class GamepadModule(BaseHardwareModule):
    name = "gamepad"

    def __init__(self, event_bus, settings) -> None:  # noqa: ANN001
        super().__init__(event_bus, settings)
        self._state = _State.SCANNING
        self._device_path: str | None = None
        self._device_name: str | None = None
        self._arbiter = ThrottleArbiter()
        self._last_steer = 0.0
        self._poll_task: asyncio.Task[None] | None = None
        self._connected = False

    async def setup(self) -> None:
        self._poll_task = asyncio.create_task(self._poll_loop(), name="gamepad-poll")
        logger.info("Gamepad module ready")

    async def loop(self) -> None:
        data = GamepadData(
            connected=self._connected,
            name=self._device_name,
            device_path=self._device_path,
        )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}gamepad",
            {"module": "gamepad", "data": data.model_dump()},
        )
        await asyncio.sleep(config.TELEMETRY_INTERVAL_SEC)

    async def cleanup(self) -> None:
        if self._poll_task:
            self._poll_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._poll_task
        logger.info("Gamepad module cleanup")

    async def _poll_loop(self) -> None:
        while True:
            if self._state == _State.SCANNING:
                found = await asyncio.to_thread(find_gamepad_device)
                if found:
                    self._device_path, self._device_name = found
                    self._state = _State.ACTIVE
                    self._connected = True
                    logger.info("Gamepad connected: %s at %s", self._device_name, self._device_path)
                else:
                    self._connected = False
                    await asyncio.sleep(config.SCAN_INTERVAL_SEC)
                continue

            if self._device_path and not is_device_present(self._device_path):
                logger.warning("Gamepad disconnected: %s", self._device_path)
                await dispatch_control(
                    self.event_bus, throttle=0, steer_deg=self._last_steer
                )
                self._device_path = None
                self._device_name = None
                self._connected = False
                self._state = _State.SCANNING
                self._arbiter = ThrottleArbiter()
                continue

            inp = await asyncio.to_thread(
                read_gamepad_input,
                self._device_path,
                self.settings.motion_steer_max_deg,
            )
            if inp is None:
                self._state = _State.SCANNING
                self._connected = False
                continue

            throttle = inp.throttle
            if inp.forward or inp.backward:
                throttle = resolve_throttle(self._arbiter, inp.forward, inp.backward)
            elif throttle == 0:
                self._arbiter = ThrottleArbiter()

            self._last_steer = inp.steer_deg
            await dispatch_control(
                self.event_bus, throttle=throttle, steer_deg=inp.steer_deg
            )
            await asyncio.sleep(config.POLL_INTERVAL_SEC)
