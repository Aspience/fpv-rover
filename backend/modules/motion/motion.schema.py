"""Motion module telemetry and command contracts."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class MotionData(BaseModel):
    steering_pos: int


class MoveCommand(BaseModel):
    cmd: Literal["move"]
    pwm_left: Annotated[int, Field(ge=0, le=100)]
    pwm_right: Annotated[int, Field(ge=0, le=100)]
    steer: Annotated[float, Field(ge=-1.0, le=1.0)] = 0.0
