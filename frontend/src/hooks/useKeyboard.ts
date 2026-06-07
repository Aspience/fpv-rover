import { useEffect } from 'react'

import { sendMove } from '@/api/websocket'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'

const KEY_PWM = 80
const TURN_DELTA = 40
const SEND_HZ = 20

const computePwm = (keys: Set<string>): { left: number; right: number } => {
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

export const useKeyboard = (): void => {
  const motionEnabled = useSystemStore((s) => s.modules.motion)
  const setPwm = useControlStore((s) => s.setPwm)

  useEffect(() => {
    if (!motionEnabled) return

    const pressed = new Set<string>()

    const onKeyDown = (event: KeyboardEvent) => {
      pressed.add(event.key.toLowerCase())
    }

    const onKeyUp = (event: KeyboardEvent) => {
      pressed.delete(event.key.toLowerCase())
    }

    const onBlur = () => {
      pressed.clear()
      setPwm(0, 0)
      sendMove(0, 0)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    const intervalId = window.setInterval(() => {
      const { left, right } = computePwm(pressed)
      setPwm(left, right)
      sendMove(left, right)
    }, 1000 / SEND_HZ)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.clearInterval(intervalId)
    }
  }, [motionEnabled, setPwm])
}
