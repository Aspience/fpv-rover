"""ThrottleArbiter first-wins tests."""

from __future__ import annotations

from modules.motion import config
from modules.motion.control import ThrottleArbiter, resolve_throttle


def test_forward_only() -> None:
    arbiter = ThrottleArbiter()
    assert resolve_throttle(arbiter, forward=True, backward=False) == config.THROTTLE_MAX


def test_backward_only() -> None:
    arbiter = ThrottleArbiter()
    assert resolve_throttle(arbiter, forward=False, backward=True) == config.THROTTLE_MIN


def test_first_wins_forward_then_backward() -> None:
    arbiter = ThrottleArbiter()
    assert resolve_throttle(arbiter, forward=True, backward=False) == config.THROTTLE_MAX
    assert resolve_throttle(arbiter, forward=True, backward=True) == config.THROTTLE_MAX


def test_first_wins_backward_then_forward() -> None:
    arbiter = ThrottleArbiter()
    assert resolve_throttle(arbiter, forward=False, backward=True) == config.THROTTLE_MIN
    assert resolve_throttle(arbiter, forward=True, backward=True) == config.THROTTLE_MIN


def test_release_both_resets() -> None:
    arbiter = ThrottleArbiter()
    resolve_throttle(arbiter, forward=True, backward=False)
    assert resolve_throttle(arbiter, forward=False, backward=False) == 0
    assert resolve_throttle(arbiter, forward=False, backward=True) == config.THROTTLE_MIN
