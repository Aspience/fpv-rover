"""Camera module command contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

RecordState = Literal["start", "stop"]


class RecordCommand(BaseModel):
    cmd: Literal["record"]
    state: RecordState
