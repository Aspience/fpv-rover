import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useHealthQuery } from '@/api/queries'
import { LOG_IDS } from '@/constants'
import { useLogStore } from '@/store/logStore'
import { selectCameraReady } from '@/store/selectors'
import { useSystemStore } from '@/store/systemStore'

export const useStartupLog = () => {
  const { t } = useTranslation()
  const appendLog = useLogStore((state) => state.appendLog)
  const { data: health } = useHealthQuery()
  const cameraAvailable = useSystemStore(selectCameraReady)
  const isReady = health?.status === 'ok' && cameraAvailable

  useEffect(() => {
    appendLog({
      id: LOG_IDS.startup,
      message: t('loading'),
      tone: 'warning',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isReady) return
    appendLog({
      id: LOG_IDS.startup,
      message: t('ready'),
      tone: 'primary',
    })
  }, [appendLog, isReady, t])
}
