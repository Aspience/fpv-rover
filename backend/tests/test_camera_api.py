"""Camera stream configuration endpoint tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from api.router import create_app
from core.event_bus import EventBus


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    app.state.event_bus = EventBus()
    return TestClient(app)


def test_set_stream_config_forwards_values(client: TestClient) -> None:
    with patch(
        "api.camera.mediamtx_set_stream_config",
        new=AsyncMock(),
    ) as mock_set:
        response = client.post(
            "/camera/stream/config",
            json={"width": 1280, "height": 720, "bitrate": 2000000},
        )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    mock_set.assert_awaited_once()
    args = mock_set.await_args.args
    assert args[-3:] == (1280, 720, 2000000)


def test_set_stream_config_maps_error_to_502(client: TestClient) -> None:
    with patch(
        "api.camera.mediamtx_set_stream_config",
        new=AsyncMock(side_effect=OSError("boom")),
    ):
        response = client.post(
            "/camera/stream/config",
            json={"width": 640, "height": 360, "bitrate": 500000},
        )

    assert response.status_code == 502


def test_set_stream_config_rejects_invalid_values(client: TestClient) -> None:
    response = client.post(
        "/camera/stream/config",
        json={"width": 0, "height": 720, "bitrate": 2000000},
    )

    assert response.status_code == 422


def test_get_stream_config_returns_current_values(client: TestClient) -> None:
    with patch(
        "api.camera.mediamtx_get_stream_config",
        new=AsyncMock(return_value={"width": 854, "height": 480, "bitrate": 1500000}),
    ) as mock_get:
        response = client.get("/camera/stream/config")

    assert response.status_code == 200
    assert response.json() == {"width": 854, "height": 480, "bitrate": 1500000}
    mock_get.assert_awaited_once()


def test_get_stream_config_maps_error_to_502(client: TestClient) -> None:
    with patch(
        "api.camera.mediamtx_get_stream_config",
        new=AsyncMock(side_effect=OSError("boom")),
    ):
        response = client.get("/camera/stream/config")

    assert response.status_code == 502
