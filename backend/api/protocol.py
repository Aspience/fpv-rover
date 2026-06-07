"""WebSocket protocol documentation endpoint for OpenAPI consumers."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.schemas.commands import HeartbeatCommand
from api.schemas.errors import ErrorMessage
from api.schemas.telemetry import TelemetryMessage
from modules.camera.schema import RecordCommand
from modules.light.schema import SetBrightnessCommand
from modules.motion.schema import MoveCommand

router = APIRouter()


class WsProtocolDocument(BaseModel):
    """JSON Schema references for the `/ws` WebSocket protocol."""

    endpoint: Literal["/ws"] = "/ws"
    server_to_client: TelemetryMessage = Field(
        description="Broadcast at 20 Hz while connected"
    )
    heartbeat: HeartbeatCommand
    move: MoveCommand
    set_brightness: SetBrightnessCommand
    record: RecordCommand
    error: ErrorMessage


@router.get("/ws-protocol", response_model=WsProtocolDocument, tags=["websocket"])
async def get_ws_protocol() -> WsProtocolDocument:
    """Document WebSocket message schemas (server does not serve WS on this path)."""
    return WsProtocolDocument(
        heartbeat=HeartbeatCommand(cmd="heartbeat"),
        move=MoveCommand(cmd="move", pwm_left=0, pwm_right=0),
        set_brightness=SetBrightnessCommand(cmd="set_brightness", level=0),
        record=RecordCommand(cmd="record", state="start"),
        error=ErrorMessage(message="example"),
    )
