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
# bluetoothctl colorizes interactive output; strip ANSI/control sequences first.
_ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")


def _clean(line: str) -> str:
    return _ANSI_RE.sub("", line).strip()


def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        [config.BLUETOOTHCTL_BIN, *args],
        capture_output=True,
        text=True,
        check=False,
        timeout=config.COMMAND_TIMEOUT_SEC,
    )
    logger.debug(
        "bluetoothctl %s -> rc=%s stdout=%r stderr=%r",
        " ".join(args),
        result.returncode,
        result.stdout.strip(),
        result.stderr.strip(),
    )
    if result.returncode != 0:
        logger.warning(
            "bluetoothctl %s failed (rc=%s): %s",
            " ".join(args),
            result.returncode,
            (result.stderr or result.stdout).strip() or "<no output>",
        )
    return result


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
        logger.info(
            "Paired devices: %d (%d connected)", len(paired), len(connected_macs)
        )
        return paired

    def _get_connected_devices(self) -> list[BluetoothDevice]:
        result = _run(["devices", "Connected"])
        return _parse_devices(result.stdout, connected=True)

    def get_connected_device(self) -> BluetoothData:
        """First currently-connected device, for telemetry."""
        connected = self._get_connected_devices()
        if not connected:
            logger.debug("No connected Bluetooth device")
            return BluetoothData(connected=False, name=None, mac=None)
        first = connected[0]
        logger.debug("Connected device: %s (%s)", first.name, first.mac)
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

    @staticmethod
    def _spawn_interactive() -> subprocess.Popen[str]:
        """Spawn ``bluetoothctl`` in interactive mode with line-buffered stdout.

        A one-shot ``bluetoothctl scan on`` exits immediately and never streams
        discoveries, so we keep an interactive session alive and feed it ``scan
        on`` on stdin. ``stdbuf -oL`` forces line buffering on the pipe; if it is
        unavailable we fall back to a plain spawn.
        """
        base = [config.BLUETOOTHCTL_BIN]
        try:
            proc = subprocess.Popen(
                ["stdbuf", "-oL", *base],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            logger.debug("Spawned interactive bluetoothctl via stdbuf")
            return proc
        except FileNotFoundError:
            logger.warning("stdbuf not found; spawning bluetoothctl without it")
            return subprocess.Popen(
                base,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

    async def start_scan(self) -> AsyncIterator[dict[str, str]]:
        """Run an interactive ``bluetoothctl`` scan and yield discovered devices.

        Yields ``{"mac": ..., "name": ...}`` parsed from ``[NEW] Device`` lines.
        Only one scan runs at a time; a stale process is stopped first.
        """
        if self.scan_process is not None:
            self.stop_scan()

        self.scan_process = self._spawn_interactive()
        logger.info("Bluetooth scan started (pid=%s)", self.scan_process.pid)

        stdin = self.scan_process.stdin
        if stdin is not None:
            stdin.write("scan on\n")
            stdin.flush()
            logger.debug("Sent 'scan on' to bluetoothctl session")

        stdout = self.scan_process.stdout
        if stdout is None:
            logger.warning("bluetoothctl scan has no stdout pipe")
            return

        found = 0
        try:
            while True:
                line = await asyncio.to_thread(stdout.readline)
                if line == "":
                    rc = self.scan_process.poll() if self.scan_process else None
                    logger.warning(
                        "bluetoothctl scan stream closed (returncode=%s) after "
                        "%d device(s); the process exited unexpectedly if this "
                        "happened immediately",
                        rc,
                        found,
                    )
                    break
                logger.debug("bluetoothctl> %s", line.rstrip())
                match = _NEW_DEVICE_RE.search(_clean(line))
                if match is None:
                    continue
                found += 1
                mac, name = match.group(1).upper(), match.group(2).strip()
                logger.info("Discovered device %s (%s)", name, mac)
                yield {"mac": mac, "name": name}
        finally:
            logger.debug("Scan loop ended after %d device(s)", found)
            self.stop_scan()

    def stop_scan(self) -> None:
        proc = self.scan_process
        if proc is not None:
            logger.info("Stopping bluetooth scan (pid=%s)", proc.pid)
            try:
                if proc.stdin is not None and not proc.stdin.closed:
                    proc.stdin.write("scan off\n")
                    proc.stdin.flush()
            except (OSError, ValueError):
                pass
            proc.terminate()
            try:
                rc = proc.wait(timeout=config.COMMAND_TIMEOUT_SEC)
                logger.debug("bluetoothctl scan process exited (returncode=%s)", rc)
            except subprocess.TimeoutExpired:
                logger.warning("bluetoothctl scan did not exit; killing")
                proc.kill()
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
