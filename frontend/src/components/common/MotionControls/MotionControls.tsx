import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

import { Lever } from '@/components/common/Lever'
import { STEER_MAX_DEG, THROTTLE_MAX, THROTTLE_MIN } from '@/constants'
import { useControlStore } from '@/store/controlStore'

interface MotionControlsProps {
  className?: string
}

export const MotionControls = ({ className = '' }: MotionControlsProps) => {
  const { t } = useTranslation()
  const throttleLocal = useControlStore((s) => s.throttleLocal)
  const steerDegLocal = useControlStore((s) => s.steerDegLocal)
  const setThrottleLocal = useControlStore((s) => s.setThrottleLocal)
  const setSteerDegLocal = useControlStore((s) => s.setSteerDegLocal)
  const setDraggingThrottle = useControlStore((s) => s.setDraggingThrottle)
  const setDraggingSteer = useControlStore((s) => s.setDraggingSteer)

  return (
    <>
      <Lever
        className={clsx('absolute bottom-4 left-4 z-dashboard', className)}
        orientation="vertical"
        min={THROTTLE_MIN}
        max={THROTTLE_MAX}
        value={throttleLocal}
        ariaLabel={t('throttleLever')}
        onDragStart={() => setDraggingThrottle(true)}
        onDragEnd={() => setDraggingThrottle(false)}
        onChange={(value) => setThrottleLocal(value, steerDegLocal)}
      />
      <Lever
        className={clsx('absolute right-4 bottom-4 z-dashboard', className)}
        orientation="horizontal"
        min={-STEER_MAX_DEG}
        max={STEER_MAX_DEG}
        value={steerDegLocal}
        ariaLabel={t('steerLever')}
        onDragStart={() => setDraggingSteer(true)}
        onDragEnd={() => setDraggingSteer(false)}
        onChange={(value) => setSteerDegLocal(value, throttleLocal)}
      />
    </>
  )
}
