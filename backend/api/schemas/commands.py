"""WebSocket client command union (module commands + transport heartbeat)."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from modules.camera.schema import RecordCommand
from modules.light.schema import SetBrightnessCommand
from modules.motion.schema import MoveCommand


class HeartbeatCommand(BaseModel):
    cmd: Literal["heartbeat"]


ClientCommand = Annotated[
    HeartbeatCommand | MoveCommand | SetBrightnessCommand | RecordCommand,
    Field(discriminator="cmd"),
]
