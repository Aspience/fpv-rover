"""FastAPI application factory and routes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI

from api.bluetooth import router as bluetooth_router
from api.camera import router as camera_router
from api.config import router as config_router
from api.health import router as health_router
from api.protocol import router as protocol_router
from api.update import router as update_router
from api.websocket import router as websocket_router

WS_DESCRIPTION = """
## WebSocket `/ws`

Real-time telemetry (rate set by `ROVER_WS_TELEMETRY_HZ`, default 20 Hz) and command channel.

### Server → client
- `TelemetryMessage` — aggregated module telemetry

### Client → server
- `HeartbeatCommand` — required every 500 ms while connected
- `MoveCommand` — throttle (−100…100) and absolute steer angle (`steer_deg`)
- `CalibrateCommand` — steering homing / encoder calibration
- `SetBrightnessCommand` — headlight level (0-100)
- `SetAutoNightModeCommand` — automatic camera night mode from ambient lux
- `RecordCommand` — start/stop camera recording (backend only today; no UI sender)

See `GET /ws-protocol` for JSON Schema definitions.
"""


def create_app(
    *,
    lifespan: Callable[[FastAPI], Any] | None = None,
) -> FastAPI:
    app = FastAPI(
        title="FPV Rover Backend",
        version="0.1.0",
        description="REST config + WebSocket telemetry/commands",
        openapi_tags=[
            {"name": "config", "description": "Module feature flags"},
            {"name": "health", "description": "Service liveness"},
            {"name": "update", "description": "OTA update check and apply"},
            {"name": "camera", "description": "Camera stream configuration"},
            {"name": "bluetooth", "description": "Bluetooth device management"},
            {"name": "websocket", "description": WS_DESCRIPTION},
        ],
        lifespan=lifespan,
    )
    app.include_router(config_router)
    app.include_router(health_router)
    app.include_router(update_router)
    app.include_router(camera_router)
    app.include_router(bluetooth_router)
    app.include_router(protocol_router)
    app.include_router(websocket_router)
    return app
