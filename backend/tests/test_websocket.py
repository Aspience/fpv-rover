import asyncio
import time

import pytest
from starlette.websockets import WebSocketState

from api.websocket import TelemetryHub
from core.config import Topics, clear_settings_cache
from core.event_bus import EventBus


@pytest.mark.asyncio
async def test_heartbeat_watchdog_publishes_emergency_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    clear_settings_cache()
    monkeypatch.setenv("ROVER_HEARTBEAT_TIMEOUT_SEC", "0.05")
    clear_settings_cache()

    bus = EventBus()
    received: asyncio.Queue[dict] = asyncio.Queue()
    stream = bus.subscribe(Topics.SYSTEM_EMERGENCY_STOP)

    async def _collect() -> None:
        async for payload in stream:
            await received.put(payload)

    collector = asyncio.create_task(_collect())

    hub = TelemetryHub(bus)

    class _FakeClient:
        client_state = WebSocketState.CONNECTED

        async def send_text(self, _message: str) -> None:
            return None

    hub._clients.add(_FakeClient())
    await hub.start()
    await asyncio.sleep(0.2)
    await hub.stop()
    collector.cancel()
    with pytest.raises(asyncio.CancelledError):
        await collector

    assert not received.empty()
    payload = received.get_nowait()
    assert payload["reason"] == "heartbeat_timeout"


@pytest.mark.asyncio
async def test_heartbeat_resets_watchdog(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_settings_cache()
    monkeypatch.setenv("ROVER_HEARTBEAT_TIMEOUT_SEC", "0.2")
    clear_settings_cache()

    bus = EventBus()
    hub = TelemetryHub(bus)
    await hub.start()
    hub.record_heartbeat()
    await hub.handle_command({"cmd": "heartbeat"})
    await asyncio.sleep(0.1)
    assert time.monotonic() - hub._last_heartbeat < 0.15
    await hub.stop()
