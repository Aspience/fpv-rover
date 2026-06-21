"""Health endpoint tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
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
    assert data["services"] == {
        "backend": data["version"],
        "frontend": data["version"],
        "mediamtx": data["version"],
    }


def test_get_health_reports_updating_during_ota() -> None:
    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    with patch("api.health.is_update_in_progress", return_value=True):
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "updating"


def test_get_health_returns_per_service_tags(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BACKEND_IMAGE_TAG", "v0.2.0")
    monkeypatch.setenv("FRONTEND_IMAGE_TAG", "v0.2.0")
    monkeypatch.setenv("MEDIAMTX_IMAGE_TAG", "v0.1.9")

    app = create_app()
    app.state.event_bus = EventBus()
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["services"] == {
        "backend": "0.2.0",
        "frontend": "0.2.0",
        "mediamtx": "0.1.9",
    }
