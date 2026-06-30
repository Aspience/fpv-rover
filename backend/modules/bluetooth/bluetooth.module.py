from __future__ import annotations

import asyncio
import logging

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.bluetooth import config
from modules.bluetooth.service import get_bluetooth_service

logger = logging.getLogger(__name__)


class BluetoothModule(BaseHardwareModule):
    name = "bluetooth"

    async def setup(self) -> None:
        logger.info("Bluetooth module ready (bluetoothctl via D-Bus)")
        self._service = get_bluetooth_service()

    async def loop(self) -> None:
        data = await asyncio.to_thread(self._service.get_connected_device)
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}bluetooth",
            {"module": "bluetooth", "data": data.model_dump()},
        )
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        self._service.stop_scan()
        logger.info("Bluetooth module cleanup")
