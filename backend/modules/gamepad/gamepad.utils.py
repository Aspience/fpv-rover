"""Gamepad evdev detection and input reading."""

from __future__ import annotations

import fcntl
import glob
import logging
import os
from dataclasses import dataclass, field

from modules.gamepad import config

logger = logging.getLogger(__name__)


@dataclass
class GamepadInput:
    forward: bool = False
    backward: bool = False
    throttle: int = 0
    steer_deg: float = 0.0


@dataclass
class _AxisState:
    buttons: set[int] = field(default_factory=set)
    axes: dict[int, int] = field(default_factory=dict)


def find_gamepad_device() -> tuple[str, str] | None:
    """Return (device_path, device_name) or None."""
    try:
        import evdev
    except ImportError:
        return None

    for path in sorted(glob.glob(config.INPUT_EVENT_GLOB)):
        try:
            device = evdev.InputDevice(path)
        except OSError:
            continue
        if not _is_gamepad(device):
            device.close()
            continue
        name = device.name or "Gamepad"
        device.close()
        if _name_matches(name):
            return path, name

    for path in sorted(glob.glob(config.INPUT_EVENT_GLOB)):
        try:
            device = evdev.InputDevice(path)
        except OSError:
            continue
        if _is_gamepad(device):
            name = device.name or "Gamepad"
            device.close()
            return path, name
    return None


def _name_matches(name: str) -> bool:
    lowered = name.lower()
    return any(sub.lower() in lowered for sub in config.DEVICE_NAME_SUBSTRINGS)


def _is_gamepad(device: object) -> bool:
    from evdev import ecodes

    caps = device.capabilities(verbose=False)  # type: ignore[attr-defined]
    keys = caps.get(ecodes.EV_KEY, [])
    abs_axes = caps.get(ecodes.EV_ABS, [])
    detect_codes = (ecodes.BTN_GAMEPAD, ecodes.BTN_SOUTH, *config.DETECT_KEY_CODES)
    has_buttons = any(code in keys for code in detect_codes)
    has_axes = len(abs_axes) >= config.MIN_ABS_AXES
    return has_buttons or has_axes


def is_device_present(path: str) -> bool:
    return os.path.exists(path)


def _normalize_axis(value: int) -> float:
    return value / max(config.THROTTLE_AXIS_MAX, 1)


def _apply_throttle_from_axis(norm: float, invert: bool) -> int:
    if invert:
        norm = -norm
    if abs(norm) <= config.AXIS_DEADZONE:
        return 0
    scaled = norm * config.THROTTLE_MAX
    return int(max(config.THROTTLE_MIN, min(config.THROTTLE_MAX, scaled)))


def _apply_steer_from_axis(norm: float, steer_max_deg: float) -> float:
    if abs(norm) <= config.AXIS_DEADZONE:
        return 0.0
    return max(-steer_max_deg, min(steer_max_deg, norm * steer_max_deg))


def read_gamepad_input(device_path: str, steer_max_deg: float) -> GamepadInput | None:
    """Non-blocking read of one gamepad state snapshot."""
    try:
        import evdev
        from evdev import ecodes
    except ImportError:
        return None

    try:
        device = evdev.InputDevice(device_path)
        flags = fcntl.fcntl(device.fileno(), fcntl.F_GETFL)
        fcntl.fcntl(device.fileno(), fcntl.F_SETFL, flags | os.O_NONBLOCK)
    except OSError:
        return None

    state = _AxisState()
    try:
        while True:
            try:
                event = device.read_one()
            except BlockingIOError:
                break
            if event is None:
                break
            if event.type == ecodes.EV_KEY:
                if event.value:
                    state.buttons.add(event.code)
                else:
                    state.buttons.discard(event.code)
            elif event.type == ecodes.EV_ABS:
                state.axes[event.code] = event.value

        forward_code = config.BINDINGS["forward"]["code"]
        backward_code = config.BINDINGS["backward"]["code"]
        throttle_axis = config.BINDINGS["throttle"]["code"]
        steer_axis = config.BINDINGS["steer"]["code"]
        throttle_invert = bool(config.BINDINGS["throttle"].get("invert", False))

        result = GamepadInput(
            forward=forward_code in state.buttons,
            backward=backward_code in state.buttons,
        )

        if throttle_axis in state.axes:
            result.throttle = _apply_throttle_from_axis(
                _normalize_axis(state.axes[throttle_axis]),
                throttle_invert,
            )

        if steer_axis in state.axes:
            result.steer_deg = _apply_steer_from_axis(
                _normalize_axis(state.axes[steer_axis]),
                steer_max_deg,
            )

        return result
    finally:
        device.close()
