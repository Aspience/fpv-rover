import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useLogStore } from '@/store/logStore'
import { useSystemStore } from '@/store/systemStore'

const CONNECTION_LOST_LOG_ID = 'connection-lost'

export const useConnectionLostLog = () => {
  const { t } = useTranslation()
  const wsConnected = useSystemStore((state) => state.wsConnected)
  const configLoaded = useSystemStore((state) => state.configLoaded)
  const appendLog = useLogStore((state) => state.appendLog)
  const removeLog = useLogStore((state) => state.removeLog)
  const wasConnectedRef = useRef(false)

  useEffect(() => {
    if (!configLoaded) return

    if (wsConnected) {
      wasConnectedRef.current = true
      removeLog(CONNECTION_LOST_LOG_ID)
      return
    }

    if (wasConnectedRef.current) {
      appendLog({
        id: CONNECTION_LOST_LOG_ID,
        message: t('connectionLost'),
        tone: 'danger',
      })
    }
  }, [appendLog, configLoaded, removeLog, t, wsConnected])
}
