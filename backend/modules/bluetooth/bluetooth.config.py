"""Bluetooth module tuning constants."""

from __future__ import annotations

import os
import shutil

# How often the module loop publishes the connected-device telemetry.
POLL_INTERVAL_SEC = 3.0

# bluetoothctl binary; overridable for tests / non-standard installs.
BLUETOOTHCTL_BIN = "bluetoothctl"

# Timeout (seconds) for one-shot bluetoothctl subprocess calls.
COMMAND_TIMEOUT_SEC = 15.0

# Bluetooth PF_BLUETOOTH/mgmt sockets are bound to the *network namespace*, and
# the kernel refuses to create them outside the host netns. When running inside
# a container on a bridge network, bluetoothctl talks to bluetoothd over D-Bus
# fine but fails to open the mgmt socket ("Unable to open mgmt_socket"), so no
# controller is usable and scans find nothing. We work around this by running
# only the bluetoothctl process in the host network namespace via ``nsenter``,
# while the HTTP server stays on the bridge network.
#
# This points at the host netns file bind-mounted into the container (see
# docker-compose.yml). Set empty to disable the wrapper (bare metal or when the
# container already uses ``network_mode: host``).
HOST_NETNS_PATH = os.environ.get("ROVER_BLUETOOTH_HOST_NETNS", "/rootns/net")


def _netns_prefix() -> list[str]:
    """``nsenter`` prefix that re-enters the host network namespace.

    Returns an empty list when the namespace file is absent or ``nsenter`` is
    unavailable, so the same code path works on bare metal and host networking.
    """
    if HOST_NETNS_PATH and os.path.exists(HOST_NETNS_PATH) and shutil.which("nsenter"):
        return ["nsenter", f"--net={HOST_NETNS_PATH}"]
    return []


def bluetoothctl_argv(args: list[str], *, line_buffered: bool = False) -> list[str]:
    """Build the full argv for invoking ``bluetoothctl``.

    Wraps the call with ``nsenter`` (host netns) when required and, for the
    streaming scan, ``stdbuf -oL`` to force line-buffered output on the pipe.
    """
    prefix = _netns_prefix()
    if line_buffered and shutil.which("stdbuf"):
        prefix += ["stdbuf", "-oL"]
    return [*prefix, BLUETOOTHCTL_BIN, *args]
