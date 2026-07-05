"""Motion module tuning constants.

Module-local defaults for control loops, calibration, and hardware drivers.
GPIO pins, PID gains (Kp/Ki/Kd), max speed, and steer angle limits are loaded
from ROVER_* environment variables via ``core.config.Settings``.
"""

from __future__ import annotations

# --- WebSocket / control protocol ---
# Maximum forward throttle command (matches MoveCommand schema).
THROTTLE_MAX = 100
# Maximum reverse throttle command.
THROTTLE_MIN = -100
# Divisor converting throttle command (±THROTTLE_MAX) to a 0..1 speed fraction.
THROTTLE_SCALE = 100.0

# --- Steering angle ↔ encoder ticks (pre-calibration fallback) ---
# Assumed encoder ticks per degree until homing establishes real span.
FALLBACK_TICKS_PER_DEG = 10.0

# --- Closed-loop PID (ControlPlusServo) ---
# Control loop update rate in Hz (one PID tick per interval).
CONTROL_LOOP_HZ = 100
# Anti-windup clamp on the PID integral term (normalized power units).
PID_INTEGRAL_CLAMP = 1.0
# Maximum absolute PID output before driving the motor driver.
PID_OUTPUT_CLAMP = 1.0
# Minimum delta-time between PID ticks to avoid divide-by-zero.
MIN_PID_DT_SEC = 1e-4
# Position-mode slowdown: ramp starts at POSITION_TOLERANCE_TICKS * this factor.
POSITION_APPROACH_FACTOR = 4

# --- Position control ---
# Stop positioning when within this many encoder ticks of the target.
POSITION_TOLERANCE_TICKS = 8

# --- TB6612FNG PWM driver ---
# Hardware PWM carrier frequency passed to pigpio.
PWM_FREQUENCY_HZ = 20_000
# pigpio PWM duty range maximum (8-bit: 0..255).
PWM_DUTY_MAX = 255
# Normalized motor power limits for set_power() and mock driver.
MOTOR_POWER_CLAMP = 1.0

# --- Encoder speed estimation ---
# Exponential smoothing window (ms) when computing ticks/sec from quadrature.
SPEED_WINDOW_MS = 100

# --- Mock hardware (development without pigpio) ---
# Convergence rate (1/s) for mock encoder speed toward the target.
MOCK_ENCODER_RESPONSE_RATE = 5.0

# --- Steering calibration (homing) ---
# Encoder speed (ticks/s) below which the steering motor is treated as stalled.
STALL_SPEED_THRESHOLD = 5.0
# Open-loop normalized power applied while sweeping for mechanical stops.
HOMING_POWER = 0.35
# Maximum duration (s) of one calibration phase before giving up.
HOMING_TIMEOUT_SEC = 15.0
# Delay (s) between stall-position checks during homing.
HOMING_POLL_INTERVAL_SEC = 0.05
# Encoder ticks that must be travelled before stall detection is evaluated.
HOMING_MIN_MOVE_TICKS = 20
# Safety travel limit (ticks) when stall is never detected.
HOMING_MAX_MOVE_TICKS = 500

# --- Telemetry ---
# Motion telemetry publish rate; should match ROVER_WS_TELEMETRY_HZ.
TELEMETRY_HZ = 20
TELEMETRY_INTERVAL_SEC = 1.0 / TELEMETRY_HZ
