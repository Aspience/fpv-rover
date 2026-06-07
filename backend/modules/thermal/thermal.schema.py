"""Thermal module telemetry contract."""

from __future__ import annotations

from pydantic import BaseModel


class ThermalData(BaseModel):
    motor_steering: float | None = None
    motor_front: float | None = None
    motor_rear: float | None = None
    bms: float | None = None
    iflight_bec: float | None = None
    tp5100: float | None = None

    model_config = {"extra": "allow"}
