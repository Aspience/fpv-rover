import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { checkUpdate } from '@/api/http'
import { LOG_IDS, UPDATE_CHECK_INTERVAL_MS } from '@/constants'
import { useLogStore } from '@/store/logStore'
import { formatVersion } from '@/utils'

export const useUpdateCheckLog = () => {
  const { t } = useTranslation()
  const appendLog = useLogStore((state) => state.appendLog)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const result = await checkUpdate()
        if (cancelled || !result.has_update || !result.latest) return
        appendLog({
          id: LOG_IDS.updateAvailable,
          message: `${t('otaUpdateAvailableLog')}: ${formatVersion(result.latest)}`,
          tone: 'warning',
          skipIfExists: true,
        })
      } catch {
        // Ignore background update-check failures; surfaced elsewhere on demand.
      }
    }

    void run()
    const timer = window.setInterval(() => void run(), UPDATE_CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [appendLog, t])
}
