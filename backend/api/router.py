"""FastAPI application factory and routes."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI

from api.config import router as config_router
from api.protocol import router as protocol_router
from api.websocket import router as websocket_router

WS_DESCRIPTION = """
## WebSocket `/ws`

Real-time telemetry (20 Hz) and command channel.

### Server → client
- `TelemetryMessage` — aggregated module telemetry

### Client → server
- `HeartbeatCommand` — required every 500 ms while connected
- `MoveCommand` — tank drive PWM (0–100 per track)
- `SetBrightnessCommand` — headlight level (0–100)
- `RecordCommand` — start/stop camera recording

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
            {"name": "websocket", "description": WS_DESCRIPTION},
        ],
        lifespan=lifespan,
    )
    app.include_router(config_router)
    app.include_router(protocol_router)
    app.include_router(websocket_router)
    return app
