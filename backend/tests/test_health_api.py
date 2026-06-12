"""Health endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.router import create_app
from core.event_bus import EventBus


def test_get_health_returns_ok() -> None:
    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data["version"], str)
    assert data["version"]
