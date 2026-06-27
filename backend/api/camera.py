"""REST camera stream configuration endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from core.config import get_settings
from core.schemas.camera import (
    CameraStreamConfigRequest,
    CameraStreamConfigResponse,
    CameraStreamConfigState,
)
from modules.camera.utils import (
    mediamtx_get_stream_config,
    mediamtx_set_stream_config,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/camera/stream/config",
    response_model=CameraStreamConfigResponse,
    tags=["camera"],
)
async def set_stream_config(
    payload: CameraStreamConfigRequest,
) -> CameraStreamConfigResponse:
    settings = get_settings()
    try:
        await mediamtx_set_stream_config(
            settings.mediamtx_api_url,
            settings.mediamtx_stream_config_path,
            settings.camera_stream_path,
            payload.width,
            payload.height,
            payload.bitrate,
        )
    except OSError as exc:
        logger.exception("Failed to update MediaMTX stream config")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to update stream config: {exc}",
        ) from exc

    return CameraStreamConfigResponse(status="ok")


@router.get(
    "/camera/stream/config",
    response_model=CameraStreamConfigState,
    tags=["camera"],
)
async def get_stream_config() -> CameraStreamConfigState:
    settings = get_settings()
    try:
        config = await mediamtx_get_stream_config(
            settings.mediamtx_api_url,
            settings.mediamtx_stream_config_get_path,
            settings.camera_stream_path,
        )
    except (OSError, KeyError, ValueError) as exc:
        logger.exception("Failed to read MediaMTX stream config")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to read stream config: {exc}",
        ) from exc

    return CameraStreamConfigState(**config)
