import { clsx } from 'clsx'
import { Gamepad2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useTelemetryStore } from '@/store/telemetryStore'
import { pingColor } from '@/utils'

interface StatusBarProps {
  className?: string
}

/**
 * Presentational status strip. Positioning is owned by the parent (App); this
 * component only renders the indicators it has data for.
 */
export const StatusBar = ({ className }: StatusBarProps) => {
  const { t } = useTranslation()
  const connected = useTelemetryStore((state) => state.bluetooth?.connected ?? false)
  const name = useTelemetryStore((state) => state.bluetooth?.name ?? null)
  const pingMs = useTelemetryStore((state) => state.pingMs)

  if (!connected) return null

  const label = name ?? t('bluetoothDeviceConnected')

  return (
    <div className={clsx('flex items-center gap-2', className)} title={label}>
      <Gamepad2 className="size-5 text-osd-primary" aria-label={label} role="img" />
      {pingMs !== null && (
        <span
          className={clsx('font-mono text-osd-sm tabular-nums', pingColor(pingMs))}
          title={t('ping')}
          aria-label={`${t('ping')}: ${pingMs} ${t('pingUnit')}`}
        >
          {pingMs} {t('pingUnit')}
        </span>
      )}
    </div>
  )
}
