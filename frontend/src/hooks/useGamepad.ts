import { useEffect } from 'react'

import { sendMove } from '@/api/websocket'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'
import { applyDeadzone, axisToPwm } from '@/utils'

const SEND_HZ = 20

export const useGamepad = (): void => {
  const motionEnabled = useSystemStore((s) => s.modules.motion)
  const setPwm = useControlStore((s) => s.setPwm)

  useEffect(() => {
    if (!motionEnabled) return

    let frameId = 0
    let lastSent = 0

    const tick = (now: number) => {
      const pads = navigator.getGamepads()
      const pad = pads[0]
      if (pad) {
        const leftY = applyDeadzone(pad.axes[1] ?? 0)
        const rightY = applyDeadzone(pad.axes[3] ?? 0)
        const pwmLeft = axisToPwm(-leftY)
        const pwmRight = axisToPwm(-rightY)

        if (now - lastSent >= 1000 / SEND_HZ) {
          setPwm(pwmLeft, pwmRight)
          sendMove(pwmLeft, pwmRight)
          lastSent = now
        }
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [motionEnabled, setPwm])
}
