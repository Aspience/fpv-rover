"""OTA update endpoint tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from api.router import create_app
from core.event_bus import EventBus


@pytest.fixture
def client() -> TestClient:
    app = create_app()
    app.state.event_bus = EventBus()
    return TestClient(app)


def test_check_update_reports_available(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    mock_response = MagicMock()
    mock_response.json.return_value = {"tag_name": "v9.9.9"}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.update.httpx.AsyncClient", return_value=mock_client):
        response = client.get("/update/check")

    assert response.status_code == 200
    data = response.json()
    assert data["latest"] == "v9.9.9"
    assert data["has_update"] is True
    assert data["current"]


def test_check_update_github_error(client: TestClient) -> None:
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(
        side_effect=httpx.HTTPError("network error"),
    )
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.update.httpx.AsyncClient", return_value=mock_client):
        response = client.get("/update/check")

    assert response.status_code == 502


def test_apply_update_disabled_by_default(client: TestClient) -> None:
    response = client.post("/update/apply")
    assert response.status_code == 403


def test_apply_update_starts_script(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ROVER_OTA_ENABLED", "true")

    mock_response = MagicMock()
    mock_response.json.return_value = {"tag_name": "v1.0.0"}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("api.update.httpx.AsyncClient", return_value=mock_client),
        patch("api.update.subprocess.Popen") as popen_mock,
    ):
        response = client.post("/update/apply")

    assert response.status_code == 200
    assert response.json() == {"status": "updating"}
    popen_mock.assert_called_once()
    call_kwargs = popen_mock.call_args.kwargs
    assert call_kwargs["args"] == ["/opt/fpv-rover/scripts/ota_update.sh", "v1.0.0"]
    assert call_kwargs["cwd"] == "/opt/fpv-rover"
    assert call_kwargs["env"]["IMAGE_TAG"] == "v1.0.0"
    assert call_kwargs["env"]["ROVER_OTA_INSTALL_DIR"] == "/opt/fpv-rover"
    assert "/root/.ssh/id_ed25519" in call_kwargs["env"]["GIT_SSH_COMMAND"]
