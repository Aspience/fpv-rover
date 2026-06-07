from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from typing import Any

from core.config import Topics
from core.event_bus import EventBus
from modules.base import BaseHardwareModule
from modules.camera import config
from modules.camera.utils import (
    mediamtx_start_record,
    mediamtx_stop_record,
    set_night_mode,
)

logger = logging.getLogger(__name__)


class CameraModule(BaseHardwareModule):
    name = "camera"

    def __init__(self, event_bus: EventBus, settings: Any) -> None:
        super().__init__(event_bus, settings)
        self._record_task: asyncio.Task[None] | None = None
        self._event_tasks: list[asyncio.Task[None]] = []

    async def setup(self) -> None:
        logger.info(
            "Camera module subscribing to EventBus (MediaMTX @ %s)",
            self.settings.mediamtx_api_url,
        )
        self._event_tasks = [
            asyncio.create_task(
                self._listen(Topics.CAMERA_RECORD_START, self._on_record_start)
            ),
            asyncio.create_task(
                self._listen(Topics.CAMERA_NIGHT_MODE, self._on_night_mode)
            ),
            asyncio.create_task(
                self._listen(Topics.SYSTEM_EMERGENCY_STOP, self._on_emergency_stop)
            ),
        ]

    async def loop(self) -> None:
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        for task in self._event_tasks:
            task.cancel()
        for task in self._event_tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._event_tasks.clear()
        if self._record_task:
            self._record_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._record_task
        logger.info("Camera module cleanup")

    async def _listen(self, topic: str, handler: Any) -> None:
        stream: AsyncIterator[dict[str, Any]] = self.event_bus.subscribe(topic)
        async for payload in stream:
            await handler(payload)

    async def _on_record_start(self, payload: dict[str, Any]) -> None:
        api_url = self.settings.mediamtx_api_url
        stream_path = self.settings.camera_stream_path
        if payload.get("stop"):
            await mediamtx_stop_record(
                api_url,
                self.settings.mediamtx_record_stop_path,
                stream_path,
            )
        else:
            await mediamtx_start_record(
                api_url,
                self.settings.mediamtx_record_start_path,
                stream_path,
            )

    async def _on_night_mode(self, payload: dict[str, Any]) -> None:
        await set_night_mode(
            bool(payload.get("enabled", False)),
            self.settings.camera_v4l2_device,
            self.settings.camera_v4l2_ctl_bin,
        )

    async def _on_emergency_stop(self, _payload: dict[str, Any]) -> None:
        with suppress(OSError):
            await mediamtx_stop_record(
                self.settings.mediamtx_api_url,
                self.settings.mediamtx_record_stop_path,
                self.settings.camera_stream_path,
            )
