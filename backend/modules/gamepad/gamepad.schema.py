"""Gamepad telemetry schema."""

from __future__ import annotations

from pydantic import BaseModel


class GamepadData(BaseModel):
    connected: bool
    name: str | None = None
    device_path: str | None = None
