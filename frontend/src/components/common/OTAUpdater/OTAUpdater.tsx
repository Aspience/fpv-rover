import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useApplyUpdateMutation,
  useCheckUpdateMutation,
  useHealthQuery,
  useOtaRecovery,
} from '@/api/queries'
import { Badge, Button } from '@/components/ui'
import { useSystemStore } from '@/store/systemStore'

import './OTAUpdater.css'

export const OTAUpdater = () => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)
  const setOtaStatus = useSystemStore((s) => s.setOtaStatus)
  const resetOtaStatus = useSystemStore((s) => s.resetOtaStatus)

  const [otaError, setOtaError] = useState<string | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [recoverySession, setRecoverySession] = useState(0)

  const { data: health } = useHealthQuery()
  const checkMutation = useCheckUpdateMutation()
  const applyMutation = useApplyUpdateMutation()

  const isRecovering = otaStatus === 'updating' && applyMutation.isSuccess

  const handleRecoverySuccess = useCallback(() => {
    setOtaStatus('success')
  }, [setOtaStatus])

  const handleRecoveryError = useCallback(
    (message: string) => {
      setOtaError(message)
      setOtaStatus('error')
    },
    [setOtaStatus],
  )

  useOtaRecovery(isRecovering, recoverySession, {
    onSuccess: handleRecoverySuccess,
    onError: handleRecoveryError,
  })

  useEffect(() => {
    if (otaStatus !== 'success') return
    const timer = window.setTimeout(() => {
      resetOtaStatus()
      applyMutation.reset()
      checkMutation.reset()
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [otaStatus, resetOtaStatus, applyMutation, checkMutation])

  const handleCheck = () => {
    setOtaError(null)
    setOtaStatus('checking')
    checkMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLatestVersion(result.latest)
        setOtaStatus(result.has_update ? 'update_available' : 'idle')
      },
      onError: (error) => {
        setOtaError(error instanceof Error ? error.message : 'Update check failed')
        setOtaStatus('error')
      },
    })
  }

  const handleApply = () => {
    setOtaError(null)
    setOtaStatus('updating')
    applyMutation.mutate(undefined, {
      onSuccess: () => setRecoverySession((session) => session + 1),
      onError: (error) => {
        setOtaError(error instanceof Error ? error.message : 'Update apply failed')
        setOtaStatus('error')
      },
    })
  }

  const isBusy = otaStatus === 'checking' || otaStatus === 'updating'

  return (
    <div className="ota-updater">
      <p className="ota-updater__version">
        {t('otaCurrentVersion')}: {health?.version ?? '—'}
      </p>

      <Button variant="ghost" disabled={isBusy} onClick={handleCheck}>
        {otaStatus === 'checking' ? t('otaChecking') : t('otaCheckUpdates')}
      </Button>

      {otaStatus === 'update_available' && latestVersion ? (
        <div className="ota-updater__available">
          <Badge tone="primary">
            {t('otaNewVersion')}: {latestVersion}
          </Badge>
          <Button variant="primary" disabled={isBusy} onClick={handleApply}>
            {t('otaInstallUpdate')}
          </Button>
        </div>
      ) : null}

      {otaStatus === 'success' ? (
        <p className="ota-updater__success">{t('otaUpdateSuccess')}</p>
      ) : null}

      {otaStatus === 'error' && otaError ? (
        <div className="ota-updater__error">
          <p>{otaError}</p>
          <Button variant="ghost" onClick={handleCheck}>
            {t('otaRetry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
