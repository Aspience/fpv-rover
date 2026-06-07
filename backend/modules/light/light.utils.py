from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def read_lux(i2c_bus: int, i2c_address: int) -> float:
    try:
        from smbus2 import SMBus  # type: ignore[import-untyped]
    except ImportError as exc:
        raise OSError("smbus2 not installed") from exc

    with SMBus(i2c_bus) as bus:
        bus.write_byte(i2c_address, 0x10)
        data = bus.read_i2c_block_data(i2c_address, 0x00, 2)
        return (data[0] << 8 | data[1]) / 1.2


def set_brightness(level: int) -> None:
    logger.debug("Light brightness set to %d", level)
