"""Quadrature encoder for LEGO Control+ motors via pigpio."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from modules.motion import config

if TYPE_CHECKING:
    import pigpio

# 4x quadrature lookup: (prev_state << 2) | new_state -> delta
_QUAD_TABLE = (
    0, 1, -1, 0,
    -1, 0, 0, 1,
    1, 0, 0, -1,
    0, -1, 1, 0,
)


class LegoEncoder:
    """Hardware quadrature decoder using pigpio level-change callbacks."""

    def __init__(self, pi: Any, tacho_a: int, tacho_b: int) -> None:
        import pigpio

        self._pi = pi
        self._tacho_a = tacho_a
        self._tacho_b = tacho_b
        self._position = 0
        self._last_state = 0
        self._last_tick_time = time.monotonic()
        self._speed = 0.0
        self._cb_a: Any | None = None
        self._cb_b: Any | None = None

        pi.set_mode(tacho_a, pigpio.INPUT)
        pi.set_mode(tacho_b, pigpio.INPUT)
        pi.set_pull_up_down(tacho_a, pigpio.PUD_UP)
        pi.set_pull_up_down(tacho_b, pigpio.PUD_UP)

        self._last_state = (pi.read(tacho_a) << 1) | pi.read(tacho_b)
        self._cb_a = pi.callback(tacho_a, pigpio.EITHER_EDGE, self._on_edge)
        self._cb_b = pi.callback(tacho_b, pigpio.EITHER_EDGE, self._on_edge)

    def _on_edge(self, _gpio: int, _level: int, tick: int) -> None:
        del tick
        state = (self._pi.read(self._tacho_a) << 1) | self._pi.read(self._tacho_b)
        delta = _QUAD_TABLE[(self._last_state << 2) | state]
        self._last_state = state
        if delta == 0:
            return

        now = time.monotonic()
        dt = now - self._last_tick_time
        self._position += delta
        if dt > 0:
            window = config.SPEED_WINDOW_MS / 1000.0
            instant = delta / dt
            alpha = min(1.0, dt / window) if window > 0 else 1.0
            self._speed = (1.0 - alpha) * self._speed + alpha * instant
        self._last_tick_time = now

    @property
    def position(self) -> int:
        return self._position

    @property
    def speed(self) -> float:
        return self._speed

    def reset(self, value: int = 0) -> None:
        self._position = value
        self._speed = 0.0
        self._last_tick_time = time.monotonic()

    def cancel(self) -> None:
        if self._cb_a is not None:
            self._cb_a.cancel()
            self._cb_a = None
        if self._cb_b is not None:
            self._cb_b.cancel()
            self._cb_b = None


class MockLegoEncoder:
    """Software encoder for development without pigpio hardware."""

    def __init__(self) -> None:
        self._position = 0
        self._speed = 0.0

    @property
    def position(self) -> int:
        return self._position

    @property
    def speed(self) -> float:
        return self._speed

    def reset(self, value: int = 0) -> None:
        self._position = value
        self._speed = 0.0

    def cancel(self) -> None:
        return

    def simulate_step(self, dt: float, power: float, max_speed: float) -> None:
        """Integrate position from applied motor power (mock physics)."""
        target = power * max_speed
        alpha = min(1.0, dt * config.MOCK_ENCODER_RESPONSE_RATE)
        self._speed = (1.0 - alpha) * self._speed + alpha * target
        self._position += int(self._speed * dt)
