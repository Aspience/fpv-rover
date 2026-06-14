"""Health check response schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ServiceVersions(BaseModel):
    backend: str = Field(description="Backend Docker image tag")
    frontend: str = Field(description="Frontend Docker image tag")
    mediamtx: str = Field(description="MediaMTX Docker image tag")


class HealthResponse(BaseModel):
    status: str = Field(description="Service liveness status")
    version: str = Field(description="Release version (IMAGE_TAG / ROVER_APP_VERSION)")
    services: ServiceVersions = Field(description="Per-service Docker image tags")
