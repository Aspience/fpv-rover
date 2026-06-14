"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from core.config import get_settings
from core.schemas.health import HealthResponse
from core.version import get_app_version, get_service_versions

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def get_health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=get_app_version(settings.app_version),
        services=get_service_versions(),
    )
