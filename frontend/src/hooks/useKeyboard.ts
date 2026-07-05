import { useEffect } from 'react'

import { sendMove } from '@/api/websocket'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'
import { CONTROL_SEND_HZ, STEER_MAX_DEG, THROTTLE_MAX } from '@/constants'

export const useKeyboard = (): void => {
  const motionEnabled = useSystemStore((s) => s.modules.motion)
  const setThrottleLocal = useControlStore((s) => s.setThrottleLocal)
  const setSteerDegLocal = useControlStore((s) => s.setSteerDegLocal)
  const steerDegLocal = useControlStore((s) => s.steerDegLocal)

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
      setThrottleLocal(0, steerDegLocal)
      sendMove(0, steerDegLocal)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    const intervalId = window.setInterval(() => {
      let throttle = 0
      let steer = steerDegLocal

      if (pressed.has('w') || pressed.has('arrowup')) throttle = THROTTLE_MAX
      if (pressed.has('s') || pressed.has('arrowdown')) throttle = -THROTTLE_MAX
      if (pressed.has('a') || pressed.has('arrowleft')) steer = -STEER_MAX_DEG
      if (pressed.has('d') || pressed.has('arrowright')) steer = STEER_MAX_DEG
      if (
        !pressed.has('a') &&
        !pressed.has('arrowleft') &&
        !pressed.has('d') &&
        !pressed.has('arrowright')
      ) {
        steer = 0
      }

      setThrottleLocal(throttle, steer)
      setSteerDegLocal(steer, throttle)
    }, 1000 / CONTROL_SEND_HZ)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.clearInterval(intervalId)
    }
  }, [motionEnabled, setSteerDegLocal, setThrottleLocal, steerDegLocal])
}
