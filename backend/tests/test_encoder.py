"""LegoEncoder quadrature table tests."""

from __future__ import annotations

# Same lookup table as hardware/encoder.py
_QUAD_TABLE = (
    0, 1, -1, 0,
    -1, 0, 0, 1,
    1, 0, 0, -1,
    0, -1, 1, 0,
)


def _step(prev: int, new: int) -> int:
    return _QUAD_TABLE[(prev << 2) | new]


def test_quadrature_forward_sequence() -> None:
    position = 0
    state = 0
    for new_state in (1, 3, 2, 0, 1, 3, 2, 0):
        position += _step(state, new_state)
        state = new_state
    assert position == 2


def test_quadrature_reverse_sequence() -> None:
    position = 0
    state = 0
    for new_state in (2, 3, 1, 0, 2, 3, 1, 0):
        position += _step(state, new_state)
        state = new_state
    assert position == -2
