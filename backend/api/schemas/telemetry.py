"""Aggregated WebSocket telemetry envelope."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from modules.imu.schema import ImuData
from modules.light.schema import LightData
from modules.motion.schema import MotionData
from modules.power.schema import PowerData
from modules.thermal.schema import ThermalData


class TelemetryModules(BaseModel):
    power: PowerData | None = None
    motion: MotionData | None = None
    light: LightData | None = None
    thermal: ThermalData | None = None
    imu: ImuData | None = None

    model_config = {"extra": "allow"}


class TelemetryMessage(BaseModel):
    type: Literal["telemetry"] = "telemetry"
    modules: TelemetryModules = Field(default_factory=TelemetryModules)
