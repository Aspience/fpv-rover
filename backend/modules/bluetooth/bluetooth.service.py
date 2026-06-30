"""Bluetooth control service backed by the ``bluetoothctl`` CLI.

Runs inside the backend container with the host D-Bus socket bind-mounted at
``/var/run/dbus``. All blocking ``subprocess`` calls are meant to be awaited
through ``asyncio.to_thread`` from async callers.
"""

from __future__ import annotations

import asyncio
import logging
import re
import subprocess
from collections.abc import AsyncIterator

from modules.bluetooth import config
from modules.bluetooth.schema import BluetoothData, BluetoothDevice

logger = logging.getLogger(__name__)

# "Device AA:BB:CC:DD:EE:FF Some Name" (optionally prefixed with [NEW]/[CHG]/...)
_DEVICE_RE = re.compile(
    r"Device\s+([0-9A-Fa-f:]{17})\s+(.+?)\s*$",
)
_NEW_DEVICE_RE = re.compile(
    r"\[NEW\]\s+Device\s+([0-9A-Fa-f:]{17})\s+(.+?)\s*$",
)


def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [config.BLUETOOTHCTL_BIN, *args],
        capture_output=True,
        text=True,
        check=False,
        timeout=config.COMMAND_TIMEOUT_SEC,
    )


def _parse_devices(stdout: str, *, connected: bool) -> list[BluetoothDevice]:
    devices: list[BluetoothDevice] = []
    for line in stdout.splitlines():
        match = _DEVICE_RE.search(line.strip())
        if match is None:
            continue
        mac, name = match.group(1).upper(), match.group(2).strip()
        devices.append(BluetoothDevice(mac=mac, name=name, connected=connected))
    return devices


class BluetoothService:
    """Manages bluetoothctl interactions and a single live scan process."""

    def __init__(self) -> None:
        self.scan_process: subprocess.Popen[str] | None = None

    def get_paired_devices(self) -> list[BluetoothDevice]:
        result = _run(["devices", "Paired"])
        paired = _parse_devices(result.stdout, connected=False)
        connected_macs = {dev.mac for dev in self._get_connected_devices()}
        for dev in paired:
            dev.connected = dev.mac in connected_macs
        return paired

    def _get_connected_devices(self) -> list[BluetoothDevice]:
        result = _run(["devices", "Connected"])
        return _parse_devices(result.stdout, connected=True)

    def get_connected_device(self) -> BluetoothData:
        """First currently-connected device, for telemetry."""
        connected = self._get_connected_devices()
        if not connected:
            return BluetoothData(connected=False, name=None, mac=None)
        first = connected[0]
        return BluetoothData(connected=True, name=first.name, mac=first.mac)

    def remove_device(self, mac: str) -> None:
        result = _run(["remove", mac])
        if result.returncode != 0:
            raise RuntimeError(
                f"bluetoothctl remove {mac} failed: "
                f"{result.stderr.strip() or result.stdout.strip()}"
            )

    def pair_and_connect(self, mac: str) -> None:
        for action in ("pair", "trust", "connect"):
            result = _run([action, mac])
            if result.returncode != 0:
                raise RuntimeError(
                    f"bluetoothctl {action} {mac} failed: "
                    f"{result.stderr.strip() or result.stdout.strip()}"
                )

    async def start_scan(self) -> AsyncIterator[dict[str, str]]:
        """Launch ``bluetoothctl scan on`` and yield discovered devices.

        Yields ``{"mac": ..., "name": ...}`` parsed from ``[NEW] Device`` lines.
        Only one scan runs at a time; a stale process is stopped first.
        """
        if self.scan_process is not None:
            self.stop_scan()

        self.scan_process = subprocess.Popen(
            [config.BLUETOOTHCTL_BIN, "scan", "on"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        logger.info("Bluetooth scan started (pid=%s)", self.scan_process.pid)

        stdout = self.scan_process.stdout
        if stdout is None:
            return

        try:
            while True:
                line = await asyncio.to_thread(stdout.readline)
                if line == "":
                    break
                match = _NEW_DEVICE_RE.search(line.strip())
                if match is None:
                    continue
                yield {"mac": match.group(1).upper(), "name": match.group(2).strip()}
        finally:
            self.stop_scan()

    def stop_scan(self) -> None:
        if self.scan_process is not None:
            logger.info("Stopping bluetooth scan (pid=%s)", self.scan_process.pid)
            self.scan_process.terminate()
            try:
                self.scan_process.wait(timeout=config.COMMAND_TIMEOUT_SEC)
            except subprocess.TimeoutExpired:
                self.scan_process.kill()
            self.scan_process = None
        # Ensure the adapter actually stops scanning even if the process exited.
        try:
            _run(["scan", "off"])
        except (OSError, subprocess.SubprocessError):
            logger.warning("Failed to issue 'scan off'", exc_info=True)


_service: BluetoothService | None = None


def get_bluetooth_service() -> BluetoothService:
    global _service
    if _service is None:
        _service = BluetoothService()
    return _service
