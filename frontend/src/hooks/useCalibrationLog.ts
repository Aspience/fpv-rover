import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useLogStore } from '@/store/logStore'
import { useTelemetryStore } from '@/store/telemetryStore'

export const useCalibrationLog = (): void => {
  const { t } = useTranslation()
  const appendLog = useLogStore((state) => state.appendLog)
  const motion = useTelemetryStore((state) => state.motion)
  const prevCalibratingRef = useRef<boolean | null>(null)
  const prevErrorRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const calibrating = motion?.calibrating ?? false
    const error = motion?.calibration_error ?? null

    const prev = prevCalibratingRef.current
    prevCalibratingRef.current = calibrating

    if (prev === null) return
    if (prev === calibrating) {
      if (error && error !== prevErrorRef.current) {
        appendLog({ message: t('calibrationFailed'), tone: 'danger' })
      }
      prevErrorRef.current = error
      return
    }

    if (calibrating) {
      appendLog({ message: t('calibrationStarted'), tone: 'primary' })
    } else if (error) {
      appendLog({ message: t('calibrationFailed'), tone: 'danger' })
    } else {
      appendLog({ message: t('calibrationFinished'), tone: 'primary' })
    }
    prevErrorRef.current = error
  }, [appendLog, motion, t])
}
