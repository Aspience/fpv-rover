"""Light module telemetry and command contracts."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class LightData(BaseModel):
    lux: float


class SetBrightnessCommand(BaseModel):
    cmd: Literal["set_brightness"]
    level: Annotated[int, Field(ge=0, le=100)]


class SetAutoNightModeCommand(BaseModel):
    cmd: Literal["set_auto_night_mode"]
    enabled: bool
    threshold_lux: Annotated[float, Field(ge=1, le=65535)]
