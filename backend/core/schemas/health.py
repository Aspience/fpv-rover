"""Health check response schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="Service liveness status")
    version: str = Field(description="Running application version")
