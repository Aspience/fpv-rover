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
        patch("api.update._resolve_helper_image", return_value="ghcr.io/acme/fpv-rover-backend:v1.0.0"),
        patch("api.update.subprocess.run") as run_mock,
        patch("api.update.subprocess.Popen") as popen_mock,
        patch("api.update.mark_update_started") as mark_mock,
    ):
        response = client.post("/update/apply")

    mark_mock.assert_called_once_with("/opt/fpv-rover", "v1.0.0")

    assert response.status_code == 200
    assert response.json() == {"status": "updating"}

    # Stale helper is force-removed before the new one is launched.
    run_mock.assert_called_once()
    assert run_mock.call_args.args[0] == ["docker", "rm", "-f", "fpv-rover-ota"]

    # The update runs in a detached sibling container, not inside the backend.
    popen_mock.assert_called_once()
    cmd = popen_mock.call_args.args[0]
    assert cmd[:4] == ["docker", "run", "--detach", "--rm"]
    assert "ghcr.io/acme/fpv-rover-backend:v1.0.0" in cmd
    assert cmd[-4:] == ["bash", "/opt/fpv-rover/scripts/ota_update.sh", "v1.0.0", "-y"]
    assert "/var/run/docker.sock:/var/run/docker.sock" in cmd
    assert "/opt/fpv-rover:/opt/fpv-rover" in cmd
    assert "IMAGE_TAG=v1.0.0" in cmd
    assert "ROVER_OTA_INSTALL_DIR=/opt/fpv-rover" in cmd
    assert popen_mock.call_args.kwargs["start_new_session"] is True
