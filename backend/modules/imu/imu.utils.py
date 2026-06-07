from __future__ import annotations


def read_imu(i2c_bus: int, i2c_address: int) -> dict[str, float]:
    try:
        from smbus2 import SMBus  # type: ignore[import-untyped]
    except ImportError as exc:
        raise OSError("smbus2 not installed") from exc

    with SMBus(i2c_bus) as bus:
        bus.write_byte_data(i2c_address, 0x6B, 0x00)
        data = bus.read_i2c_block_data(i2c_address, 0x3B, 6)
        ax = int.from_bytes(bytes(data[0:2]), "big", signed=True) / 16384.0
        ay = int.from_bytes(bytes(data[2:4]), "big", signed=True) / 16384.0
        az = int.from_bytes(bytes(data[4:6]), "big", signed=True) / 16384.0
        return {"ax_g": ax, "ay_g": ay, "az_g": az}
