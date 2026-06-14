"""Application version helpers."""

from __future__ import annotations

import os

from core.config import get_settings
from core.schemas.health import ServiceVersions


def normalize_tag(tag: str) -> str:
    return tag.strip().removeprefix("v")


def get_app_version(fallback: str = "0.0.0") -> str:
    settings = get_settings()
    return normalize_tag(settings.app_version or fallback)


def get_service_versions() -> ServiceVersions:
    settings = get_settings()
    release = get_app_version(settings.app_version)
    return ServiceVersions(
        backend=normalize_tag(os.environ.get("BACKEND_IMAGE_TAG", release)),
        frontend=normalize_tag(os.environ.get("FRONTEND_IMAGE_TAG", release)),
        mediamtx=normalize_tag(os.environ.get("MEDIAMTX_IMAGE_TAG", release)),
    )
