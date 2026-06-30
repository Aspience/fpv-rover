"""Bluetooth REST + WebSocket endpoint and module telemetry tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.router import create_app
from core.config import Topics
from core.event_bus import EventBus
from modules.bluetooth.module import BluetoothModule
from modules.bluetooth.schema import BluetoothData, BluetoothDevice


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    app.state.event_bus = EventBus()
    return TestClient(app)


def _enabled_settings() -> SimpleNamespace:
    return SimpleNamespace(modules_bluetooth_enabled=True)


def test_list_devices_disabled_returns_404(client: TestClient) -> None:
    # Default config (.env.example) has the module disabled.
    response = client.get("/bluetooth/devices")
    assert response.status_code == 404


def test_list_devices_returns_paired(client: TestClient) -> None:
    service = MagicMock()
    service.get_paired_devices.return_value = [
        BluetoothDevice(mac="AA:BB:CC:DD:EE:FF", name="Gamepad", connected=True),
    ]

    with (
        patch("api.bluetooth.get_settings", return_value=_enabled_settings()),
        patch("api.bluetooth.get_bluetooth_service", return_value=service),
    ):
        response = client.get("/bluetooth/devices")

    assert response.status_code == 200
    assert response.json() == [
        {"mac": "AA:BB:CC:DD:EE:FF", "name": "Gamepad", "connected": True},
    ]
    service.get_paired_devices.assert_called_once()


def test_pair_device_invokes_service(client: TestClient) -> None:
    service = MagicMock()

    with (
        patch("api.bluetooth.get_settings", return_value=_enabled_settings()),
        patch("api.bluetooth.get_bluetooth_service", return_value=service),
    ):
        response = client.post("/bluetooth/pair", json={"mac": "AA:BB:CC:DD:EE:FF"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    service.pair_and_connect.assert_called_once_with("AA:BB:CC:DD:EE:FF")


def test_pair_device_maps_error_to_502(client: TestClient) -> None:
    service = MagicMock()
    service.pair_and_connect.side_effect = RuntimeError("boom")

    with (
        patch("api.bluetooth.get_settings", return_value=_enabled_settings()),
        patch("api.bluetooth.get_bluetooth_service", return_value=service),
    ):
        response = client.post("/bluetooth/pair", json={"mac": "AA:BB:CC:DD:EE:FF"})

    assert response.status_code == 502


def test_remove_device_invokes_service(client: TestClient) -> None:
    service = MagicMock()

    with (
        patch("api.bluetooth.get_settings", return_value=_enabled_settings()),
        patch("api.bluetooth.get_bluetooth_service", return_value=service),
    ):
        response = client.delete("/bluetooth/devices/AA:BB:CC:DD:EE:FF")

    assert response.status_code == 200
    service.remove_device.assert_called_once_with("AA:BB:CC:DD:EE:FF")


def test_scan_ws_stops_scan_on_disconnect(client: TestClient) -> None:
    service = MagicMock()

    async def fake_scan() -> AsyncIterator[dict[str, str]]:
        yield {"mac": "AA:BB:CC:DD:EE:FF", "name": "Gamepad"}

    service.start_scan = fake_scan

    with (
        patch("api.bluetooth.get_settings", return_value=_enabled_settings()),
        patch("api.bluetooth.get_bluetooth_service", return_value=service),
    ):
        with client.websocket_connect("/bluetooth/scan-ws") as ws:
            assert ws.receive_json() == {
                "mac": "AA:BB:CC:DD:EE:FF",
                "name": "Gamepad",
            }

    # finally block must always tear the adapter scan down.
    service.stop_scan.assert_called_once()


def test_scan_ws_rejected_when_disabled(client: TestClient) -> None:
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/bluetooth/scan-ws") as ws:
            ws.receive_text()


@pytest.mark.asyncio
async def test_module_publishes_connected_telemetry() -> None:
    bus = EventBus()
    module = BluetoothModule(bus, SimpleNamespace())
    module._service = MagicMock()
    module._service.get_connected_device.return_value = BluetoothData(
        connected=True, name="Gamepad", mac="AA:BB:CC:DD:EE:FF"
    )

    stream = bus.subscribe(f"{Topics.TELEMETRY_PREFIX}bluetooth")
    task = asyncio.create_task(module.loop())
    try:
        payload = await asyncio.wait_for(stream.__anext__(), timeout=1.0)
    finally:
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    assert payload["module"] == "bluetooth"
    assert payload["data"]["connected"] is True
    assert payload["data"]["name"] == "Gamepad"
