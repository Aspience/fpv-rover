"""Gamepad module tuning constants.

Evdev scan/poll intervals, Linux input event codes, and axis scaling for
mapping a physical gamepad to motion throttle/steer commands.
"""

from __future__ import annotations

# --- Device discovery ---
# Interval (s) between scans for a newly connected gamepad when none is active.
SCAN_INTERVAL_SEC = 1.0
# Glob pattern for evdev event nodes scanned on Linux.
INPUT_EVENT_GLOB = "/dev/input/event*"
# Case-insensitive substrings matched against evdev device names.
DEVICE_NAME_SUBSTRINGS = (
    "Xbox",
    "DualShock",
    "8BitDo",
    "Gamepad",
    "Wireless Controller",
)
# Minimum number of absolute axes required to classify a device as a gamepad.
MIN_ABS_AXES = 2

# --- Active polling ---
# Input poll interval (s) while a gamepad is connected (~100 Hz).
POLL_INTERVAL_SEC = 0.01

# --- Telemetry ---
# How often connection status is published on the event bus (Hz).
TELEMETRY_HZ = 3
TELEMETRY_INTERVAL_SEC = 1.0 / TELEMETRY_HZ

# --- Linux input event codes (linux/input-event-codes.h) ---
# BTN_SOUTH / A — forward.
BTN_FORWARD = 304
# BTN_EAST / B — backward.
BTN_BACKWARD = 305
# Left stick X — steering axis.
AXIS_STEER = 0
# Left stick Y — throttle axis.
AXIS_THROTTLE = 1
# Event codes checked when detecting gamepad-capable evdev devices.
DETECT_KEY_CODES = (BTN_FORWARD, BTN_BACKWARD)

# --- Axis scaling ---
# Full-scale value for 16-bit evdev ABS axes (used to normalize to ±1).
THROTTLE_AXIS_MAX = 32767
# Invert throttle axis so stick-up maps to forward (device-dependent).
THROTTLE_AXIS_INVERT = True
# Normalized deadzone; axis deflection below this is treated as zero.
AXIS_DEADZONE = 0.05

# --- Command mapping (must match motion protocol) ---
THROTTLE_MAX = 100
THROTTLE_MIN = -100

# Binding table consumed by gamepad.utils (codes reference constants above).
BINDINGS: dict[str, dict[str, object]] = {
    "forward": {"type": "button", "code": BTN_FORWARD},
    "backward": {"type": "button", "code": BTN_BACKWARD},
    "steer": {"type": "axis", "code": AXIS_STEER},
    "throttle": {"type": "axis", "code": AXIS_THROTTLE, "invert": THROTTLE_AXIS_INVERT},
}
