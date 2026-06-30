"""OpenAPI schema tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.router import create_app
from core.event_bus import EventBus


def test_openapi_contains_contract_schemas() -> None:
    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schemas = response.json()["components"]["schemas"]
    assert "ConfigResponse" in schemas
    assert "TelemetryMessage" in schemas
    assert "MoveCommand" in schemas
    assert "HeartbeatCommand" in schemas
    assert "ErrorMessage" in schemas
    assert "WsProtocolDocument" in schemas
    assert "BluetoothData" in schemas
    assert "BluetoothDevice" in schemas


def test_swagger_docs_available() -> None:
    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    response = client.get("/docs")

    assert response.status_code == 200
