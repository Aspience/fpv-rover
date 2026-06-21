import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { pingHealth } from '@/api/http'
import { useLogStore } from '@/store/logStore'
import { useSystemStore } from '@/store/systemStore'

const STORAGE_KEY = 'fpv-rover.ota-updating'
const POLL_INTERVAL_MS = 5000
const MAX_DURATION_MS = 15 * 60 * 1000
const START_LOG_ID = 'ota-update-start'
const PROGRESS_LOG_ID = 'ota-update-progress'

const isOtaUpdatingPersisted = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const markOtaUpdating = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore storage failures (e.g. private mode); flow still works in-memory.
  }
}

const clearOtaUpdating = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Drives the OTA "updating" flow at the app root so it survives a full page
 * reload: it logs progress to the event log, blocks the UI via `otaStatus`,
 * polls `/health` until the rover reports a non-updating status, then reloads.
 */
export const useOtaUpdater = (): void => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)
  const setOtaStatus = useSystemStore((s) => s.setOtaStatus)
  const appendLog = useLogStore((s) => s.appendLog)

  // Resume a pending update after a hard page reload.
  useEffect(() => {
    if (isOtaUpdatingPersisted() && useSystemStore.getState().otaStatus !== 'updating') {
      setOtaStatus('updating')
    }
  }, [setOtaStatus])

  useEffect(() => {
    if (otaStatus !== 'updating') return

    markOtaUpdating()
    appendLog({ id: START_LOG_ID, message: t('otaUpdateStarted'), tone: 'primary' })

    const startedAt = Date.now()
    let stopped = false
    let timer = 0

    const logProgress = () => {
      appendLog({ id: PROGRESS_LOG_ID, message: t('otaUpdateInProgress'), tone: 'primary' })
    }

    const stop = () => {
      stopped = true
      window.clearInterval(timer)
    }

    const poll = async () => {
      if (stopped) return

      if (Date.now() - startedAt > MAX_DURATION_MS) {
        stop()
        clearOtaUpdating()
        setOtaStatus('error')
        appendLog({ message: t('otaUpdateFailedLog'), tone: 'danger' })
        return
      }

      try {
        const health = await pingHealth()
        if (stopped) return
        if (health.status === 'updating') {
          logProgress()
          return
        }
        // Rover is back online with a normal status: the update finished.
        stop()
        clearOtaUpdating()
        window.location.reload()
      } catch {
        if (stopped) return
        // Backend is momentarily unreachable (restarting) — still in progress.
        logProgress()
      }
    }

    timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    void poll()

    return () => {
      stop()
    }
  }, [otaStatus, appendLog, setOtaStatus, t])
}
