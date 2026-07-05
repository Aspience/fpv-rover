"""Closed-loop PID controller for LEGO Control+ motors."""

from __future__ import annotations

import asyncio
import enum
import logging
from dataclasses import dataclass
from typing import Protocol

from modules.motion import config
from modules.motion.hardware.driver import MockTB6612FNG_Motor, TB6612FNG_Motor
from modules.motion.hardware.encoder import MockLegoEncoder, LegoEncoder

logger = logging.getLogger(__name__)


class ServoMode(enum.Enum):
    IDLE = "idle"
    SPEED = "speed"
    POSITION = "position"
    OPEN_LOOP = "open_loop"


@dataclass
class PidGains:
    kp: float
    ki: float
    kd: float


class _EncoderProto(Protocol):
    @property
    def position(self) -> int: ...

    @property
    def speed(self) -> float: ...

    def reset(self, value: int = 0) -> None: ...

    def cancel(self) -> None: ...


class _MotorProto(Protocol):
    def set_power(self, power: float) -> None: ...

    def stop(self) -> None: ...

    def brake(self) -> None: ...


class ControlPlusServo:
    """Encoder + motor driver with PI/PID closed-loop control."""

    def __init__(
        self,
        name: str,
        encoder: _EncoderProto,
        motor: _MotorProto,
        pid: PidGains,
        max_speed_ticks: float,
    ) -> None:
        self.name = name
        self._encoder = encoder
        self._motor = motor
        self._pid = pid
        self._max_speed = max_speed_ticks
        self._mode = ServoMode.IDLE
        self._target_speed = 0.0
        self._target_position = 0
        self._integral = 0.0
        self._last_error = 0.0
        self._last_power = 0.0
        self._task: asyncio.Task[None] | None = None
        self._mock_encoder = isinstance(encoder, MockLegoEncoder)
        self._mock_motor = isinstance(motor, MockTB6612FNG_Motor)

    @property
    def mode(self) -> ServoMode:
        return self._mode

    @property
    def speed(self) -> float:
        return self._encoder.speed

    @property
    def position(self) -> int:
        return self._encoder.position

    async def start(self) -> None:
        if self._task is not None:
            return
        self._task = asyncio.create_task(self._control_loop(), name=f"servo-{self.name}")

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        self.halt()

    def run_at_speed(self, target_ticks_per_sec: float) -> None:
        self._mode = ServoMode.SPEED
        self._target_speed = target_ticks_per_sec
        self._integral = 0.0
        self._last_error = 0.0

    def run_to_position(self, target_ticks: int) -> None:
        self._mode = ServoMode.POSITION
        self._target_position = target_ticks
        self._integral = 0.0
        self._last_error = 0.0

    def halt(self) -> None:
        self._mode = ServoMode.IDLE
        self._target_speed = 0.0
        self._integral = 0.0
        self._last_error = 0.0
        self._last_power = 0.0
        self._motor.stop()

    def brake(self) -> None:
        self.halt()
        self._motor.brake()

    def drive_open_loop(self, power: float) -> None:
        """Apply raw motor power bypassing the PID loop (calibration only)."""
        self._mode = ServoMode.OPEN_LOOP
        self._last_power = max(-config.MOTOR_POWER_CLAMP, min(config.MOTOR_POWER_CLAMP, power))
        self._motor.set_power(self._last_power)

    async def _control_loop(self) -> None:
        interval = 1.0 / config.CONTROL_LOOP_HZ
        try:
            while True:
                self._tick(interval)
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            self._motor.stop()
            raise

    def _tick(self, dt: float) -> None:
        if self._mock_encoder and self._mock_motor:
            self._encoder.simulate_step(dt, self._last_power, self._max_speed)

        if self._mode == ServoMode.IDLE:
            self._motor.stop()
            self._last_power = 0.0
            return

        if self._mode == ServoMode.OPEN_LOOP:
            return

        if self._mode == ServoMode.SPEED:
            error = self._target_speed - self._encoder.speed
        else:
            error = float(self._target_position - self._encoder.position)
            distance = abs(error)
            if distance < config.POSITION_TOLERANCE_TICKS:
                self._motor.stop()
                self._last_power = 0.0
                return
            # Slow near target
            scale = min(
                config.MOTOR_POWER_CLAMP,
                distance
                / max(
                    config.POSITION_TOLERANCE_TICKS * config.POSITION_APPROACH_FACTOR,
                    1,
                ),
            )
            error *= scale

        dt_safe = max(dt, config.MIN_PID_DT_SEC)
        self._integral += error * dt_safe
        self._integral = max(
            -config.PID_INTEGRAL_CLAMP,
            min(config.PID_INTEGRAL_CLAMP, self._integral),
        )
        derivative = (error - self._last_error) / dt_safe
        self._last_error = error

        output = (
            self._pid.kp * error
            + self._pid.ki * self._integral
            + self._pid.kd * derivative
        )
        power = max(-config.PID_OUTPUT_CLAMP, min(config.PID_OUTPUT_CLAMP, output))
        self._last_power = power
        self._motor.set_power(power)
