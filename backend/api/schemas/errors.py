"""WebSocket error response contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str = Field(description="Human-readable error detail")
