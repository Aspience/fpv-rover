"""Unified control command dispatch and throttle arbitration."""

from __future__ import annotations

import enum

from core.config import Topics
from core.event_bus import EventBus
from modules.motion import config


class ThrottleDirection(enum.Enum):
    NONE = "none"
    FORWARD = "forward"
    BACKWARD = "backward"


class ThrottleArbiter:
    """First-wins resolution when forward and backward are active together."""

    def __init__(self) -> None:
        self._active = ThrottleDirection.NONE

    def resolve(self, forward: bool, backward: bool) -> int:
        if forward and backward:
            if self._active == ThrottleDirection.NONE:
                self._active = ThrottleDirection.FORWARD
        elif forward:
            self._active = ThrottleDirection.FORWARD
        elif backward:
            self._active = ThrottleDirection.BACKWARD
        else:
            self._active = ThrottleDirection.NONE
            return 0

        if self._active == ThrottleDirection.FORWARD:
            return config.THROTTLE_MAX if forward else 0
        if self._active == ThrottleDirection.BACKWARD:
            return config.THROTTLE_MIN if backward else 0
        return 0


async def dispatch_control(
    event_bus: EventBus,
    *,
    throttle: int,
    steer_deg: float,
) -> None:
    """Single entry point for publishing motion control commands."""
    await event_bus.publish(
        Topics.COMMAND_CONTROL,
        {"throttle": throttle, "steer_deg": steer_deg},
    )


def resolve_throttle(arbiter: ThrottleArbiter, forward: bool, backward: bool) -> int:
    return arbiter.resolve(forward, backward)
