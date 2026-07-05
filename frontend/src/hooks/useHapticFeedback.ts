import { useCallback, useRef } from 'react'

import { HAPTIC_LIMIT_PULSE_MS, HAPTIC_ZERO_PULSE_MS } from '@/constants'

export const useHapticFeedback = () => {
  const atLimitRef = useRef(false)
  const atZeroRef = useRef(true)

  const pulse = useCallback((durationMs: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(durationMs)
    }
  }, [])

  const onValueChange = useCallback(
    (value: number, min: number, max: number) => {
      const atLimit = value <= min || value >= max
      if (atLimit && !atLimitRef.current) {
        pulse(HAPTIC_LIMIT_PULSE_MS)
      }
      atLimitRef.current = atLimit

      const atZero = value === 0
      if (atZero && !atZeroRef.current) {
        pulse(HAPTIC_ZERO_PULSE_MS)
      }
      atZeroRef.current = atZero
    },
    [pulse],
  )

  return { onValueChange }
}
