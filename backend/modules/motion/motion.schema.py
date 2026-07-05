"""Motion module telemetry and command contracts."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from modules.motion import config as motion_config


class MotionData(BaseModel):
    steering_pos: int
    throttle_applied: int = 0
    steer_deg_applied: float = 0.0
    calibrating: bool = False
    calibration_error: str | None = None
    front_speed: float = 0.0
    rear_speed: float = 0.0


class MoveCommand(BaseModel):
    cmd: Literal["move"]
    throttle: Annotated[
        int,
        Field(ge=motion_config.THROTTLE_MIN, le=motion_config.THROTTLE_MAX),
    ]
    steer_deg: float = 0.0


class CalibrateCommand(BaseModel):
    cmd: Literal["calibrate"]
