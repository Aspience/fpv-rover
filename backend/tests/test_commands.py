"""WebSocket command dispatch tests."""

from __future__ import annotations

import asyncio

import pytest

from api.websocket import TelemetryHub
from core.config import Topics
from core.event_bus import EventBus


@pytest.mark.asyncio
async def test_move_command_publishes_control() -> None:
    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.COMMAND_CONTROL)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    hub = TelemetryHub(bus)

    await hub.handle_command({"cmd": "move", "throttle": 80, "steer_deg": 15.0})

    payload = await asyncio.wait_for(received.get(), timeout=1.0)
    collector.cancel()
    assert payload == {"throttle": 80, "steer_deg": 15.0}


@pytest.mark.asyncio
async def test_calibrate_command_publishes_event() -> None:
    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.COMMAND_CALIBRATE)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())
    hub = TelemetryHub(bus)

    await hub.handle_command({"cmd": "calibrate"})

    payload = await asyncio.wait_for(received.get(), timeout=1.0)
    collector.cancel()
    assert payload["source"] == "frontend"


@pytest.mark.asyncio
async def test_invalid_command_is_rejected() -> None:
    bus = EventBus()
    hub = TelemetryHub(bus)

    class _FakeWebSocket:
        def __init__(self) -> None:
            self.sent: list[str] = []

        async def send_text(self, message: str) -> None:
            self.sent.append(message)

    ws = _FakeWebSocket()
    await hub.handle_command({"cmd": "move", "throttle": 200}, websocket=ws)

    assert len(ws.sent) == 1
    assert '"type":"error"' in ws.sent[0] or '"type": "error"' in ws.sent[0]
