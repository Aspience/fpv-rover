from __future__ import annotations

import asyncio
import logging

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.thermal import config
from modules.thermal.utils import read_temperature_c

logger = logging.getLogger(__name__)


class ThermalModule(BaseHardwareModule):
    name = "thermal"

    async def setup(self) -> None:
        logger.info(
            "Thermal module ready (%d DS18B20 sensors)",
            len(self.settings.thermal_sensor_ids),
        )

    async def loop(self) -> None:
        readings: dict[str, float] = {}
        for node, rom_id in self.settings.thermal_sensor_ids.items():
            readings[node] = await asyncio.to_thread(
                read_temperature_c,
                self.settings.w1_base_path,
                self.settings.thermal_w1_slave_file,
                node,
                rom_id,
            )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}thermal",
            {"module": "thermal", "data": readings},
        )
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        logger.info("Thermal module cleanup")
