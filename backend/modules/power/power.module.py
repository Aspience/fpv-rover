from __future__ import annotations

import asyncio
import logging

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.power import config
from modules.power.utils import read_power_metrics

logger = logging.getLogger(__name__)


class PowerModule(BaseHardwareModule):
    name = "power"

    async def setup(self) -> None:
        logger.info(
            "Power module ready (INA219 @ 0x%02x)",
            self.settings.power_i2c_address,
        )

    async def loop(self) -> None:
        metrics = await asyncio.to_thread(
            read_power_metrics,
            self.settings.i2c_bus,
            self.settings.power_i2c_address,
        )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}power",
            {"module": "power", "data": metrics},
        )
        if metrics["voltage_v"] < config.LOW_VOLTAGE_THRESHOLD:
            logger.warning("Low battery: %.2f V", metrics["voltage_v"])
        await asyncio.sleep(config.POLL_INTERVAL_SEC)

    async def cleanup(self) -> None:
        logger.info("Power module cleanup")
