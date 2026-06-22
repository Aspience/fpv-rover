import { useEffect } from 'react'

import { sendMove } from '@/api/websocket'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'
import { CONTROL_SEND_HZ } from '@/constants'
import { computePwm } from '@/utils'

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
    }, 1000 / CONTROL_SEND_HZ)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.clearInterval(intervalId)
    }
  }, [motionEnabled, setPwm])
}
