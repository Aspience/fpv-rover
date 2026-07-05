"""Motion control application logic."""

from __future__ import annotations

import asyncio
import logging
import time

from core.config import Settings
from modules.motion import config
from modules.motion.hardware import MotionHardware

logger = logging.getLogger(__name__)

_left_stop: int | None = None
_right_stop: int | None = None
_ticks_per_deg: float | None = None
_calibrating = False
_calibration_error: str | None = None
_throttle_applied = 0
_steer_deg_applied = 0.0


def is_calibrating() -> bool:
    return _calibrating


def calibration_error() -> str | None:
    return _calibration_error


def throttle_applied() -> int:
    return _throttle_applied


def steer_deg_applied() -> float:
    return _steer_deg_applied


def deg_to_ticks(deg: float, steer_max_deg: float) -> int:
    if _left_stop is not None and _right_stop is not None and _ticks_per_deg:
        clamped = max(-steer_max_deg, min(steer_max_deg, deg))
        return int(clamped * _ticks_per_deg)
    return int(deg * config.FALLBACK_TICKS_PER_DEG)


def ticks_to_deg(ticks: int) -> float:
    if _ticks_per_deg:
        return ticks / _ticks_per_deg
    return float(ticks) / config.FALLBACK_TICKS_PER_DEG


def apply_control(hw: MotionHardware, throttle: int, steer_deg: float, settings: Settings) -> None:
    global _throttle_applied, _steer_deg_applied
    _throttle_applied = throttle
    _steer_deg_applied = steer_deg

    max_speed = settings.motion_max_speed_ticks
    speed = (throttle / config.THROTTLE_SCALE) * max_speed
    if throttle == 0:
        hw.front.halt()
        hw.rear.halt()
    else:
        hw.front.run_at_speed(speed)
        hw.rear.run_at_speed(speed)

    target_ticks = deg_to_ticks(steer_deg, settings.motion_steer_max_deg)
    hw.steer.run_to_position(target_ticks)


def stop_all(hw: MotionHardware) -> None:
    global _throttle_applied
    _throttle_applied = 0
    hw.brake_all()


async def calibrate_steering(hw: MotionHardware, settings: Settings) -> None:
    global _left_stop, _right_stop, _ticks_per_deg, _calibrating, _calibration_error

    _calibrating = True
    _calibration_error = None
    steer = hw.steer
    steer_max = settings.motion_steer_max_deg

    try:
        left = await _drive_until_stall(steer, direction=-1)
        right = await _drive_until_stall(steer, direction=1)
        _left_stop = left
        _right_stop = right
        center = (left + right) // 2
        await _move_to_position(steer, center)
        steer._encoder.reset(0)  # noqa: SLF001
        span = abs(right - left)
        _ticks_per_deg = (
            span / (2.0 * steer_max)
            if span > 0
            else config.FALLBACK_TICKS_PER_DEG
        )
        logger.info(
            "Steering calibrated: left=%s right=%s center=%s ticks_per_deg=%.2f",
            left,
            right,
            center,
            _ticks_per_deg,
        )
    except Exception as exc:
        _calibration_error = str(exc)
        logger.exception("Steering calibration failed")
        steer.brake()
    finally:
        _calibrating = False


async def _drive_until_stall(steer, direction: int) -> int:  # noqa: ANN001
    """Drive steering until encoder speed drops (stall)."""
    start = steer.position
    deadline = time.monotonic() + config.HOMING_TIMEOUT_SEC
    steer.drive_open_loop(config.HOMING_POWER * direction)

    try:
        while time.monotonic() < deadline:
            await asyncio.sleep(config.HOMING_POLL_INTERVAL_SEC)
            moved = abs(steer.position - start)
            if (
                moved > config.HOMING_MIN_MOVE_TICKS
                and abs(steer.speed) < config.STALL_SPEED_THRESHOLD
            ):
                break
            if moved > config.HOMING_MAX_MOVE_TICKS:
                break
        return steer.position
    finally:
        steer.halt()


async def _move_to_position(steer, target: int) -> None:  # noqa: ANN001
    steer.run_to_position(target)
    deadline = time.monotonic() + config.HOMING_TIMEOUT_SEC
    while time.monotonic() < deadline:
        if abs(target - steer.position) <= config.POSITION_TOLERANCE_TICKS:
            steer.halt()
            return
        await asyncio.sleep(config.HOMING_POLL_INTERVAL_SEC)
    steer.halt()
