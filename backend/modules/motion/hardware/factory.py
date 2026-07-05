"""Motion hardware factory and lifecycle."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from core.config import Settings
from modules.motion.hardware.driver import MockTB6612FNG_Motor, TB6612FNG_Motor
from modules.motion.hardware.encoder import MockLegoEncoder, LegoEncoder
from modules.motion.hardware.servo import ControlPlusServo, PidGains

logger = logging.getLogger(__name__)


@dataclass
class MotionHardware:
    front: ControlPlusServo
    rear: ControlPlusServo
    steer: ControlPlusServo
    mock: bool
    pi: Any | None = None

    async def start(self) -> None:
        await self.front.start()
        await self.rear.start()
        await self.steer.start()

    async def stop(self) -> None:
        await self.front.stop()
        await self.rear.stop()
        await self.steer.stop()
        if self.pi is not None:
            self.pi.stop()

    def brake_all(self) -> None:
        self.front.brake()
        self.rear.brake()
        self.steer.brake()


def init_motion_hardware(settings: Settings) -> MotionHardware:
    """Create three ControlPlusServo instances from settings GPIO map."""
    pid = PidGains(
        kp=settings.motion_pid_kp,
        ki=settings.motion_pid_ki,
        kd=settings.motion_pid_kd,
    )
    max_speed = float(settings.motion_max_speed_ticks)
    motors = settings.motion_motors()

    try:
        import pigpio
    except ImportError:
        logger.warning("pigpio Python module not installed — using mock hardware")
        return _mock_hardware(pid, max_speed)

    pi = pigpio.pi(settings.pigpio_host, settings.pigpio_port)
    if not pi.connected:
        logger.warning(
            "pigpiod unreachable at %s:%s — using mock hardware",
            settings.pigpio_host,
            settings.pigpio_port,
        )
        pi.stop()
        return _mock_hardware(pid, max_speed)

    def _build(name: str) -> ControlPlusServo:
        cfg = motors[name]
        encoder = LegoEncoder(pi, cfg.tacho_a, cfg.tacho_b)
        motor = TB6612FNG_Motor(pi, cfg.pwma, cfg.ain1, cfg.ain2)
        return ControlPlusServo(name, encoder, motor, pid, max_speed)

    logger.info(
        "Motion hardware connected via pigpiod at %s:%s",
        settings.pigpio_host,
        settings.pigpio_port,
    )
    return MotionHardware(
        front=_build("front"),
        rear=_build("rear"),
        steer=_build("steer"),
        mock=False,
        pi=pi,
    )


def _mock_hardware(pid: PidGains, max_speed: float) -> MotionHardware:
    def _build(name: str) -> ControlPlusServo:
        encoder = MockLegoEncoder()
        motor = MockTB6612FNG_Motor()
        return ControlPlusServo(name, encoder, motor, pid, max_speed)

    return MotionHardware(
        front=_build("front"),
        rear=_build("rear"),
        steer=_build("steer"),
        mock=True,
        pi=None,
    )
