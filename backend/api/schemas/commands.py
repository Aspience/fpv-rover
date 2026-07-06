"""WebSocket client command union (module commands + transport heartbeat)."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from modules.camera.schema import RecordCommand
from modules.light.schema import SetAutoNightModeCommand, SetBrightnessCommand
from modules.motion.schema import CalibrateCommand, MoveCommand


class HeartbeatCommand(BaseModel):
    cmd: Literal["heartbeat"]
    # Client-side epoch milliseconds; echoed back via telemetry for RTT/ping.
    ts: int | None = None


ClientCommand = Annotated[
    HeartbeatCommand
    | MoveCommand
    | CalibrateCommand
    | SetBrightnessCommand
    | SetAutoNightModeCommand
    | RecordCommand,
    Field(discriminator="cmd"),
]
