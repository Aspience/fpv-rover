"""Read bus voltage and current from INA219. Raises OSError on I2C failure."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def read_power_metrics(i2c_bus: int, i2c_address: int) -> dict[str, float]:
    try:
        from smbus2 import SMBus  # type: ignore[import-untyped]
    except ImportError as exc:
        raise OSError("smbus2 not installed") from exc

    with SMBus(i2c_bus) as bus:
        raw = bus.read_i2c_block_data(i2c_address, 0x02, 2)
        voltage = ((raw[0] << 3) | (raw[1] >> 5)) * 0.001
        raw_current = bus.read_i2c_block_data(i2c_address, 0x04, 2)
        current = int.from_bytes(bytes(raw_current), "big", signed=True) * 0.001
        return {"voltage_v": voltage, "current_a": current}
