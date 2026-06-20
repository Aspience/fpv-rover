import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useHealthQuery } from '@/api/queries'
import { useLogStore } from '@/store/logStore'
import { selectCameraReady } from '@/store/selectors'
import { useSystemStore } from '@/store/systemStore'

const STARTUP_LOG_ID = 'startup'

export const useStartupLog = () => {
  const { t } = useTranslation()
  const appendLog = useLogStore((state) => state.appendLog)
  const { data: health } = useHealthQuery()
  const cameraAvailable = useSystemStore(selectCameraReady)
  const isReady = health?.status === 'ok' && cameraAvailable

  useEffect(() => {
    appendLog({
      id: STARTUP_LOG_ID,
      message: t('loading'),
      tone: 'warning',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isReady) return
    appendLog({
      id: STARTUP_LOG_ID,
      message: t('ready'),
      tone: 'primary',
    })
  }, [appendLog, isReady, t])
}
