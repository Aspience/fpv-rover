from __future__ import annotations

from pathlib import Path


def read_temperature_c(
    w1_base_path: str,
    w1_slave_file: str,
    node: str,
    rom_id: str,
) -> float:
    path = Path(w1_base_path) / rom_id / w1_slave_file
    if not path.exists():
        raise OSError(f"DS18B20 node missing: {node} ({rom_id})")
    content = path.read_text(encoding="utf-8")
    if "YES" not in content:
        raise OSError(f"CRC fail for {node}")
    for line in content.splitlines():
        if line.startswith("t="):
            return int(line.split("=")[1]) / 1000.0
    raise OSError(f"No temperature in {node}")
