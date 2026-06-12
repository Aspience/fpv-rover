"""OTA update response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UpdateCheckResponse(BaseModel):
    current: str = Field(description="Installed version on this device")
    latest: str | None = Field(description="Latest release tag from GitHub")
    has_update: bool = Field(description="Whether a newer release is available")


class UpdateApplyResponse(BaseModel):
    status: str = Field(description="Update lifecycle status")
