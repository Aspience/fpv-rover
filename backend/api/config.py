"""REST configuration endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from core.config import get_settings
from core.schemas.config import ConfigResponse, ModulesConfig

router = APIRouter()


@router.get("/config", response_model=ConfigResponse, tags=["config"])
async def get_config() -> ConfigResponse:
    return ConfigResponse(modules=ModulesConfig(**get_settings().enabled_modules()))
