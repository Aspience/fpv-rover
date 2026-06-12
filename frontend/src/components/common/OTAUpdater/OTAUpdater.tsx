import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { pingHealth } from '@/api/health'
import { Badge, Button } from '@/components/ui'
import { useSystemStore } from '@/store/systemStore'

import './OTAUpdater.css'

export const OTAUpdater = () => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)
  const versions = useSystemStore((s) => s.versions)
  const otaError = useSystemStore((s) => s.otaError)
  const checkForUpdate = useSystemStore((s) => s.checkForUpdate)
  const applyOtaUpdate = useSystemStore((s) => s.applyOtaUpdate)
  const resetOtaStatus = useSystemStore((s) => s.resetOtaStatus)

  useEffect(() => {
    void pingHealth()
      .then((health) => {
        useSystemStore.setState((state) => ({
          versions: { ...state.versions, current: health.version },
        }))
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (otaStatus !== 'success') return
    const timer = window.setTimeout(() => resetOtaStatus(), 5000)
    return () => window.clearTimeout(timer)
  }, [otaStatus, resetOtaStatus])

  const isBusy = otaStatus === 'checking' || otaStatus === 'updating'

  return (
    <div className="ota-updater">
      <p className="ota-updater__version">
        {t('otaCurrentVersion')}: {versions.current ?? '—'}
      </p>

      <Button
        variant="ghost"
        disabled={isBusy}
        onClick={() => void checkForUpdate()}
      >
        {otaStatus === 'checking' ? t('otaChecking') : t('otaCheckUpdates')}
      </Button>

      {otaStatus === 'update_available' && versions.latest ? (
        <div className="ota-updater__available">
          <Badge tone="primary">
            {t('otaNewVersion')}: {versions.latest}
          </Badge>
          <Button variant="primary" disabled={isBusy} onClick={() => void applyOtaUpdate()}>
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
          <Button variant="ghost" onClick={() => void checkForUpdate()}>
            {t('otaRetry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
