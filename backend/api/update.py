"""OTA update check and apply endpoints."""

from __future__ import annotations

import logging
import os
import socket
import subprocess
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from core.config import get_settings
from core.ota_state import clear_update_marker, mark_update_started
from core.schemas.update import UpdateApplyResponse, UpdateCheckResponse
from core.version import get_current_version, normalize_tag

logger = logging.getLogger(__name__)

router = APIRouter()

GITHUB_API = "https://api.github.com"
# Deploy key mount target inside the backend container (see docker-compose.prod.yml).
OTA_CONTAINER_SSH_KEY = "/root/.ssh/id_ed25519"
# Mount target for the install dir inside the OTA helper container.
OTA_HELPER_WORKDIR = "/opt/fpv-rover"
# Name of the detached helper container that performs the update.
OTA_HELPER_CONTAINER = "fpv-rover-ota"


def _github_headers(token: str) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _fetch_latest_release_tag() -> str | None:
    settings = get_settings()
    url = f"{GITHUB_API}/repos/{settings.github_owner}/{settings.github_repo}/releases/latest"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url, headers=_github_headers(settings.github_token)
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.exception("Failed to fetch latest release from GitHub")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach GitHub releases API: {exc}",
        ) from exc

    payload: dict[str, Any] = response.json()
    tag_name = payload.get("tag_name")
    return tag_name if isinstance(tag_name, str) else None


def _resolve_helper_image() -> str | None:
    """Image the OTA helper container should run.

    Prefers the running backend container's own image (it bundles the docker
    CLI, compose, git and bash the script needs), falling back to a registry
    reference built from configuration if self-inspection fails.
    """
    try:
        container_id = socket.gethostname()
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.Config.Image}}", container_id],
            capture_output=True,
            text=True,
            check=True,
            timeout=15,
        )
        image = result.stdout.strip()
        if image:
            return image
    except (OSError, subprocess.SubprocessError):
        logger.warning("Could not inspect own container image for OTA helper", exc_info=True)

    settings = get_settings()
    registry = os.environ.get("FPV_ROVER_IMAGE_REGISTRY", "ghcr.io").strip().strip("/")
    image_tag = (
        os.environ.get("BACKEND_IMAGE_TAG", "").strip()
        or os.environ.get("IMAGE_TAG", "").strip()
    )
    if not image_tag:
        return None
    return f"{registry}/{settings.github_owner}/{settings.github_repo}-backend:{image_tag}"


def _run_ota_script(tag: str) -> None:
    """Launch the OTA update in a detached sibling container.

    The update recreates the backend container via ``docker compose up``. If the
    script ran inside the backend container, that recreation would kill it
    mid-flight and leave the update half-applied. Running it as a separate
    container (started through the host docker socket, outside the compose
    project) lets the update survive the backend restart and finish.
    """
    settings = get_settings()
    install_dir = settings.ota_install_dir
    ssh_key = settings.ota_ssh_key_path

    image = _resolve_helper_image()
    if image is None:
        logger.error("Could not determine OTA helper image; aborting update")
        clear_update_marker(install_dir)
        return

    git_ssh_command = (
        f"ssh -i {OTA_CONTAINER_SSH_KEY} -o StrictHostKeyChecking=accept-new "
        "-o IdentitiesOnly=yes"
    )

    cmd: list[str] = [
        "docker",
        "run",
        "--detach",
        "--rm",
        "--name",
        OTA_HELPER_CONTAINER,
        # Host networking so the helper can reach the published backend port for
        # the post-update health check (localhost:ROVER_PORT on the host).
        "--network",
        "host",
        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",
        "-v",
        f"{install_dir}:{OTA_HELPER_WORKDIR}",
    ]
    if ssh_key:
        cmd += ["-v", f"{ssh_key}:{OTA_CONTAINER_SSH_KEY}:ro"]
    cmd += [
        "-w",
        OTA_HELPER_WORKDIR,
        "-e",
        f"IMAGE_TAG={tag}",
        "-e",
        f"ROVER_OTA_INSTALL_DIR={install_dir}",
        "-e",
        f"GIT_SSH_COMMAND={git_ssh_command}",
        image,
        "bash",
        settings.ota_script,
        tag,
        "-y",
    ]

    # Remove any leftover helper from a previous interrupted run before starting.
    try:
        subprocess.run(
            ["docker", "rm", "-f", OTA_HELPER_CONTAINER],
            capture_output=True,
            check=False,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        logger.warning("Failed to remove stale OTA helper container", exc_info=True)

    try:
        subprocess.Popen(cmd, start_new_session=True)
    except OSError:
        logger.exception("Failed to start OTA helper container")
        clear_update_marker(install_dir)


@router.get("/update/check", response_model=UpdateCheckResponse, tags=["update"])
async def check_update() -> UpdateCheckResponse:
    current = get_current_version()
    latest = await _fetch_latest_release_tag()
    has_update = latest is not None and normalize_tag(latest) != normalize_tag(current)
    return UpdateCheckResponse(current=current, latest=latest, has_update=has_update)


@router.post("/update/apply", response_model=UpdateApplyResponse, tags=["update"])
async def apply_update(background_tasks: BackgroundTasks) -> UpdateApplyResponse:
    settings = get_settings()
    if not settings.ota_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OTA updates are disabled on this device",
        )

    latest = await _fetch_latest_release_tag()
    if latest is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not determine latest release tag",
        )

    mark_update_started(settings.ota_install_dir, latest)
    background_tasks.add_task(_run_ota_script, latest)
    return UpdateApplyResponse(status="updating")
