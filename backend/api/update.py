"""OTA update check and apply endpoints."""

from __future__ import annotations

import logging
import os
import subprocess
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from core.config import get_settings
from core.schemas.update import UpdateApplyResponse, UpdateCheckResponse
from core.version import get_app_version, normalize_tag

logger = logging.getLogger(__name__)

router = APIRouter()

GITHUB_API = "https://api.github.com"
# Deploy key mount target inside the backend container (see docker-compose.prod.yml).
OTA_CONTAINER_SSH_KEY = "/root/.ssh/id_ed25519"


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


def _run_ota_script(tag: str) -> None:
    settings = get_settings()
    script = settings.ota_script
    install_dir = settings.ota_install_dir
    env = os.environ.copy()
    env["ROVER_OTA_INSTALL_DIR"] = install_dir
    env["IMAGE_TAG"] = tag
    # ROVER_OTA_SSH_KEY_PATH is the host path for compose volume mounts; git runs in-container.
    env["GIT_SSH_COMMAND"] = (
        f"ssh -i {OTA_CONTAINER_SSH_KEY} -o StrictHostKeyChecking=accept-new "
        "-o IdentitiesOnly=yes"
    )

    try:
        subprocess.Popen(
            [script, tag],
            cwd=install_dir,
            env=env,
            start_new_session=True,
        )
    except OSError:
        logger.exception("Failed to start OTA script")


@router.get("/update/check", response_model=UpdateCheckResponse, tags=["update"])
async def check_update() -> UpdateCheckResponse:
    current = get_app_version(get_settings().app_version)
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

    background_tasks.add_task(_run_ota_script, latest)
    return UpdateApplyResponse(status="updating")
