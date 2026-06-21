import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useApplyUpdateMutation,
  useCheckUpdateMutation,
  useHealthQuery,
} from '@/api/queries'
import { Badge, Button } from '@/components/ui'
import { markOtaUpdating } from '@/hooks'
import { useLogStore } from '@/store/logStore'
import { useSystemStore } from '@/store/systemStore'
import { formatVersion } from '@/utils'

interface OTAUpdaterProps {
  onInstallStart?: () => void
}

export const OTAUpdater = ({ onInstallStart }: OTAUpdaterProps) => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)
  const setOtaStatus = useSystemStore((s) => s.setOtaStatus)

  const [otaError, setOtaError] = useState<string | null>(null)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)

  const { data: health } = useHealthQuery()
  const appendLog = useLogStore((s) => s.appendLog)
  const checkMutation = useCheckUpdateMutation()
  const applyMutation = useApplyUpdateMutation()

  const handleCheck = () => {
    setOtaError(null)
    setOtaStatus('checking')
    checkMutation.mutate(undefined, {
      onSuccess: (result) => {
        setLatestVersion(result.latest)
        setOtaStatus(result.has_update ? 'update_available' : 'idle')
        if (!result.has_update) {
          const versions = health?.services
            ? `${t('otaServiceBackend')} ${formatVersion(health.services.backend)} · ${t('otaServiceFrontend')} ${formatVersion(health.services.frontend)} · ${t('otaServiceMediamtx')} ${formatVersion(health.services.mediamtx)}`
            : formatVersion(result.current)
          appendLog({
            message: `${t('otaUpToDate')}: ${versions}`,
            tone: 'primary',
          })
        }
      },
      onError: (error) => {
        setOtaError(error instanceof Error ? error.message : 'Update check failed')
        setOtaStatus('error')
      },
    })
  }

  const handleApply = () => {
    onInstallStart?.()
    setOtaError(null)
    applyMutation.mutate(undefined, {
      onSuccess: () => {
        // The update flow (logging, polling /health, reload) is driven by
        // useOtaUpdater once the status flips to 'updating'.
        markOtaUpdating()
        setOtaStatus('updating')
      },
      onError: (error) => {
        setOtaError(error instanceof Error ? error.message : 'Update apply failed')
        setOtaStatus('error')
      },
    })
  }

  const isBusy =
    otaStatus === 'checking' || otaStatus === 'updating' || applyMutation.isPending
  const services = health?.services

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-osd-primary/20 pt-3">
      {services ? (
        <p className="m-0 text-[length:calc(var(--text-osd-xs)*0.9)] leading-snug text-osd-muted/75">
          {t('otaServiceBackend')} {formatVersion(services.backend)}
          {' · '}
          {t('otaServiceFrontend')} {formatVersion(services.frontend)}
          {' · '}
          {t('otaServiceMediamtx')} {formatVersion(services.mediamtx)}
        </p>
      ) : null}

      <Button variant="ghost" disabled={isBusy} onClick={handleCheck}>
        {otaStatus === 'checking' ? t('otaChecking') : t('otaCheckUpdates')}
      </Button>

      {otaStatus === 'update_available' && latestVersion ? (
        <div className="flex flex-col gap-2">
          <Badge tone="primary">
            {t('otaNewVersion')}: {latestVersion}
          </Badge>
          <Button variant="primary" disabled={isBusy} onClick={handleApply}>
            {t('otaInstallUpdate')}
          </Button>
        </div>
      ) : null}

      {otaStatus === 'success' ? (
        <p className="m-0 text-osd-xs text-osd-primary">{t('otaUpdateSuccess')}</p>
      ) : null}

      {otaStatus === 'error' && otaError ? (
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-osd-xs text-osd-danger">{otaError}</p>
          <Button variant="ghost" onClick={handleCheck}>
            {t('otaRetry')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
