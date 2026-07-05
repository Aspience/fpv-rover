"""TB6612FNG motor driver control via pigpio PWM."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from modules.motion import config

if TYPE_CHECKING:
    import pigpio


class TB6612FNG_Motor:
    """Single H-bridge channel on TB6612FNG."""

    def __init__(
        self,
        pi: Any,
        pwma: int,
        ain1: int,
        ain2: int,
        pwm_freq: int = config.PWM_FREQUENCY_HZ,
    ) -> None:
        import pigpio

        self._pi = pi
        self._pwma = pwma
        self._ain1 = ain1
        self._ain2 = ain2

        pi.set_mode(pwma, pigpio.OUTPUT)
        pi.set_mode(ain1, pigpio.OUTPUT)
        pi.set_mode(ain2, pigpio.OUTPUT)
        pi.set_PWM_frequency(pwma, pwm_freq)
        pi.set_PWM_range(pwma, config.PWM_DUTY_MAX)
        self.stop()

    def set_power(self, power: float) -> None:
        """Apply signed power in [-MOTOR_POWER_CLAMP, MOTOR_POWER_CLAMP] as direction + PWM duty."""
        clamped = max(-config.MOTOR_POWER_CLAMP, min(config.MOTOR_POWER_CLAMP, power))
        duty = int(abs(clamped) * config.PWM_DUTY_MAX)
        if clamped > 0:
            self._pi.write(self._ain1, 1)
            self._pi.write(self._ain2, 0)
        elif clamped < 0:
            self._pi.write(self._ain1, 0)
            self._pi.write(self._ain2, 1)
        else:
            self.stop()
            return
        self._pi.set_PWM_dutycycle(self._pwma, duty)

    def stop(self) -> None:
        self._pi.set_PWM_dutycycle(self._pwma, 0)
        self._pi.write(self._ain1, 0)
        self._pi.write(self._ain2, 0)

    def brake(self) -> None:
        self._pi.set_PWM_dutycycle(self._pwma, 0)
        self._pi.write(self._ain1, 1)
        self._pi.write(self._ain2, 1)


class MockTB6612FNG_Motor:
    """No-op motor driver for development."""

    def __init__(self) -> None:
        self.power = 0.0

    def set_power(self, power: float) -> None:
        self.power = max(-config.MOTOR_POWER_CLAMP, min(config.MOTOR_POWER_CLAMP, power))

    def stop(self) -> None:
        self.power = 0.0

    def brake(self) -> None:
        self.power = 0.0
