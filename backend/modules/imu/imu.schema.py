"""IMU module telemetry contract."""

from __future__ import annotations

from pydantic import BaseModel


class ImuData(BaseModel):
    ax_g: float
    ay_g: float
    az_g: float
