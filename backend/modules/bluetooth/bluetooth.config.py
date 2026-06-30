"""Bluetooth module tuning constants."""

from __future__ import annotations

# How often the module loop publishes the connected-device telemetry.
POLL_INTERVAL_SEC = 3.0

# bluetoothctl binary; overridable for tests / non-standard installs.
BLUETOOTHCTL_BIN = "bluetoothctl"

# Timeout (seconds) for one-shot bluetoothctl subprocess calls.
COMMAND_TIMEOUT_SEC = 15.0
