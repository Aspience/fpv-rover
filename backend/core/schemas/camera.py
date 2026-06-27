"""REST camera stream contract models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CameraStreamConfigRequest(BaseModel):
    width: int = Field(gt=0, le=7680, description="Stream frame width in pixels")
    height: int = Field(gt=0, le=4320, description="Stream frame height in pixels")
    bitrate: int = Field(gt=0, description="Stream bitrate in bits per second")


class CameraStreamConfigResponse(BaseModel):
    status: str = Field(description="Result of the stream config update")


class CameraStreamConfigState(BaseModel):
    width: int = Field(description="Current stream frame width in pixels")
    height: int = Field(description="Current stream frame height in pixels")
    bitrate: int = Field(description="Current stream bitrate in bits per second")
