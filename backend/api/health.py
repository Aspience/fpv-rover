"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from core.schemas.health import HealthResponse
from core.version import get_app_version

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def get_health() -> HealthResponse:
    return HealthResponse(status="ok", version=get_app_version())
