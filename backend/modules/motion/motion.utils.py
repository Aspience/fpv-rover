from __future__ import annotations

import logging

from modules.motion import config

logger = logging.getLogger(__name__)

_steering_position = 0
_left_stop: int | None = None
_right_stop: int | None = None


def get_steering_position() -> int:
    return _steering_position


def set_steering_position(value: int) -> None:
    global _steering_position
    _steering_position = value


def set_pwm(left: float, right: float, steer: float) -> None:
    logger.debug("PWM left=%.2f right=%.2f steer=%.2f", left, right, steer)


def read_encoder(channel: str) -> int:
    return _steering_position if channel == "steering" else 0


def read_motor_current(channel: str) -> float:
    return 0.0


async def calibrate_steering() -> int:
    """Homing via stall detection: find left/right stops, center, reset to 0."""
    global _left_stop, _right_stop, _steering_position

    position = 0
    set_pwm(0.0, 0.0, -config.HOMING_SPEED)
    while read_motor_current("steering") < config.STALL_CURRENT_THRESHOLD_A:
        position -= 1
        set_steering_position(position)
        if abs(position) > 500:
            break
    _left_stop = position

    set_pwm(0.0, 0.0, config.HOMING_SPEED)
    while read_motor_current("steering") < config.STALL_CURRENT_THRESHOLD_A:
        position += 1
        set_steering_position(position)
        if abs(position) > 1000:
            break
    _right_stop = position

    center = (_left_stop + _right_stop) // 2
    set_steering_position(center)
    set_pwm(0.0, 0.0, 0.0)
    _steering_position = 0
    logger.info(
        "Steering calibrated: left=%s right=%s center=%s",
        _left_stop,
        _right_stop,
        center,
    )
    return 0
