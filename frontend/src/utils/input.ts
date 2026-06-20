const DEADZONE = 0.1
const KEY_PWM = 80
const TURN_DELTA = 40

export const applyDeadzone = (value: number): number => {
  return Math.abs(value) < DEADZONE ? 0 : value
}

export const axisToPwm = (value: number): number => {
  return Math.round(Math.abs(applyDeadzone(value)) * 100)
}

export const computePwm = (keys: Set<string>): { left: number; right: number } => {
  let left = 0
  let right = 0

  const forward = keys.has('w') || keys.has('arrowup')
  const back = keys.has('s') || keys.has('arrowdown')
  const leftTurn = keys.has('a') || keys.has('arrowleft')
  const rightTurn = keys.has('d') || keys.has('arrowright')

  if (forward) {
    left = KEY_PWM
    right = KEY_PWM
  }
  if (back) {
    left = 0
    right = 0
  }
  if (leftTurn) {
    left = Math.max(left, KEY_PWM)
    right = Math.max(0, right - TURN_DELTA)
  }
  if (rightTurn) {
    right = Math.max(right, KEY_PWM)
    left = Math.max(0, left - TURN_DELTA)
  }

  return { left, right }
}
