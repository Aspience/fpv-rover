import {
  GAMEPAD_DEADZONE,
  KEYBOARD_PWM,
  KEYBOARD_TURN_DELTA,
  PWM_MAX,
} from '@/constants'

export const applyDeadzone = (value: number): number => {
  return Math.abs(value) < GAMEPAD_DEADZONE ? 0 : value
}

export const axisToPwm = (value: number): number => {
  return Math.round(Math.abs(applyDeadzone(value)) * PWM_MAX)
}

export const computePwm = (keys: Set<string>): { left: number; right: number } => {
  let left = 0
  let right = 0

  const forward = keys.has('w') || keys.has('arrowup')
  const back = keys.has('s') || keys.has('arrowdown')
  const leftTurn = keys.has('a') || keys.has('arrowleft')
  const rightTurn = keys.has('d') || keys.has('arrowright')

  if (forward) {
    left = KEYBOARD_PWM
    right = KEYBOARD_PWM
  }
  if (back) {
    left = 0
    right = 0
  }
  if (leftTurn) {
    left = Math.max(left, KEYBOARD_PWM)
    right = Math.max(0, right - KEYBOARD_TURN_DELTA)
  }
  if (rightTurn) {
    right = Math.max(right, KEYBOARD_PWM)
    left = Math.max(0, left - KEYBOARD_TURN_DELTA)
  }

  return { left, right }
}
