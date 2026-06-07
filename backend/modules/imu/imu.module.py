from __future__ import annotations

import asyncio
import logging

from core.config import Topics
from modules.base import BaseHardwareModule
from modules.imu import config
from modules.imu.utils import read_imu

logger = logging.getLogger(__name__)


class ImuModule(BaseHardwareModule):
    name = "imu"

    async def setup(self) -> None:
        logger.info(
            "IMU module ready (MPU6050 @ 0x%02x)",
            self.settings.imu_i2c_address,
        )

    async def loop(self) -> None:
        data = await asyncio.to_thread(
            read_imu,
            self.settings.i2c_bus,
            self.settings.imu_i2c_address,
        )
        await self.event_bus.publish(
            f"{Topics.TELEMETRY_PREFIX}imu",
            {"module": "imu", "data": data},
        )
        await asyncio.sleep(1.0 / config.SAMPLE_RATE_HZ)

    async def cleanup(self) -> None:
        logger.info("IMU module cleanup")
