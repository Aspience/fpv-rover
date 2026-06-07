"""Power module telemetry contract."""

from __future__ import annotations

from pydantic import BaseModel


class PowerData(BaseModel):
    voltage_v: float
    current_a: float
