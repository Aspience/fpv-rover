"""REST configuration contract models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ModulesConfig(BaseModel):
    power: bool = False
    motion: bool = False
    thermal: bool = False
    imu: bool = False
    light: bool = False
    camera: bool = False
    bluetooth: bool = False


class ConfigResponse(BaseModel):
    modules: ModulesConfig = Field(description="Enabled hardware modules")
