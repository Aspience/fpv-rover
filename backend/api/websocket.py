"""WebSocket telemetry hub and command channel with heartbeat watchdog."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import suppress
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError
from starlette.websockets import WebSocketState

from api.schemas.commands import ClientCommand, HeartbeatCommand
from api.schemas.errors import ErrorMessage
from api.schemas.telemetry import TelemetryMessage, TelemetryModules
from core.config import Topics, get_settings
from core.event_bus import EventBus
from modules.camera.schema import RecordCommand
from modules.light.schema import SetAutoNightModeCommand, SetBrightnessCommand
from modules.motion.control import dispatch_control
from modules.motion.schema import CalibrateCommand, MoveCommand

logger = logging.getLogger(__name__)

router = APIRouter()
_client_command_adapter: TypeAdapter[ClientCommand] = TypeAdapter(ClientCommand)


class TelemetryHub:
    """Aggregates telemetry from EventBus and manages client heartbeats."""

    def __init__(self, event_bus: EventBus) -> None:
        self.event_bus = event_bus
        self.settings = get_settings()
        self._telemetry: dict[str, Any] = {}
        self._last_heartbeat: float = time.monotonic()
        self._last_client_ts: int | None = None
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._running = False
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._tasks = [
            asyncio.create_task(
                self._telemetry_collector(), name="telemetry-collector"
            ),
            asyncio.create_task(self._broadcast_loop(), name="telemetry-broadcast"),
            asyncio.create_task(self._watchdog_loop(), name="heartbeat-watchdog"),
        ]

    async def stop(self) -> None:
        self._running = False
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()
        self._clients.clear()

    async def register_client(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.add(websocket)
        self._last_heartbeat = time.monotonic()

    async def unregister_client(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(websocket)

    def record_heartbeat(self) -> None:
        self._last_heartbeat = time.monotonic()

    async def handle_command(
        self,
        payload: dict[str, Any],
        *,
        websocket: WebSocket | None = None,
    ) -> None:
        try:
            command = _client_command_adapter.validate_python(payload)
        except ValidationError as exc:
            if websocket is not None:
                error = ErrorMessage(message=str(exc))
                await websocket.send_text(error.model_dump_json())
            return

        if isinstance(command, HeartbeatCommand):
            self.record_heartbeat()
            if command.ts is not None:
                self._last_client_ts = command.ts
            return

        if isinstance(command, MoveCommand):
            await dispatch_control(
                self.event_bus,
                throttle=command.throttle,
                steer_deg=command.steer_deg,
            )
            return

        if isinstance(command, CalibrateCommand):
            await self.event_bus.publish(Topics.COMMAND_CALIBRATE, {"source": "frontend"})
            return

        if isinstance(command, SetBrightnessCommand):
            await self.event_bus.publish(
                Topics.COMMAND_LIGHT,
                {"level": command.level},
            )
            return

        if isinstance(command, SetAutoNightModeCommand):
            await self.event_bus.publish(
                Topics.COMMAND_LIGHT_AUTO_NIGHT,
                {
                    "enabled": command.enabled,
                    "threshold_lux": command.threshold_lux,
                },
            )
            return

        if isinstance(command, RecordCommand):
            await self.event_bus.publish(
                Topics.CAMERA_RECORD_START,
                {"stop": command.state == "stop"},
            )

    async def _telemetry_collector(self) -> None:
        stream = self.event_bus.subscribe(f"{Topics.TELEMETRY_PREFIX}*")
        try:
            async for payload in stream:
                module = payload.get("module")
                if module:
                    self._telemetry[module] = payload.get("data", payload)
        except asyncio.CancelledError:
            pass

    async def _broadcast_loop(self) -> None:
        interval = 1.0 / self.settings.ws_telemetry_hz
        while self._running:
            message = TelemetryMessage(
                modules=TelemetryModules.model_validate(self._telemetry),
                client_ts=self._last_client_ts,
            ).model_dump_json()
            async with self._lock:
                dead: list[WebSocket] = []
                for client in self._clients:
                    if client.client_state != WebSocketState.CONNECTED:
                        dead.append(client)
                        continue
                    try:
                        await client.send_text(message)
                    except Exception:
                        dead.append(client)
                for client in dead:
                    self._clients.discard(client)
            await asyncio.sleep(interval)

    async def _watchdog_loop(self) -> None:
        while self._running:
            await asyncio.sleep(0.1)
            if not self._clients:
                self._last_heartbeat = time.monotonic()
                continue
            elapsed = time.monotonic() - self._last_heartbeat
            if elapsed > self.settings.heartbeat_timeout_sec:
                logger.warning(
                    "Heartbeat timeout (%.2fs); publishing emergency_stop",
                    elapsed,
                )
                await self.event_bus.publish(
                    Topics.SYSTEM_EMERGENCY_STOP,
                    {"reason": "heartbeat_timeout", "elapsed_sec": elapsed},
                )
                self._last_heartbeat = time.monotonic()


_hub: TelemetryHub | None = None


def get_hub(event_bus: EventBus) -> TelemetryHub:
    global _hub
    if _hub is None:
        _hub = TelemetryHub(event_bus)
    return _hub


def reset_hub() -> None:
    global _hub
    _hub = None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    app = websocket.app
    event_bus: EventBus = app.state.event_bus
    hub = get_hub(event_bus)

    await websocket.accept()
    await hub.register_client(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                error = ErrorMessage(message="invalid json")
                await websocket.send_text(error.model_dump_json())
                continue
            await hub.handle_command(payload, websocket=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unregister_client(websocket)
