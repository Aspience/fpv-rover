"""REST config endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from api.router import create_app
from core.event_bus import EventBus


def test_get_config_returns_modules() -> None:
    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    response = client.get("/config")

    assert response.status_code == 200
    data = response.json()
    assert "modules" in data
    assert set(data["modules"]) == {
        "power",
        "motion",
        "thermal",
        "imu",
        "light",
        "camera",
        "bluetooth",
        "gamepad",
    }
    for enabled in data["modules"].values():
        assert isinstance(enabled, bool)
