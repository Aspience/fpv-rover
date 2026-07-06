import { clsx } from 'clsx'
import { Gamepad2, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui'
import { useSystemStore } from '@/store/systemStore'
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
  const lightEnabled = useSystemStore((s) => s.modules.light)
  const thermalEnabled = useSystemStore((s) => s.modules.thermal)
  const connected = useTelemetryStore((state) => state.bluetooth?.connected ?? false)
  const name = useTelemetryStore((state) => state.bluetooth?.name ?? null)
  const pingMs = useTelemetryStore((state) => state.pingMs)
  const light = useTelemetryStore((state) => state.light)
  const thermal = useTelemetryStore((state) => state.thermal)

  const showGamepad = connected
  const showLight = lightEnabled && light !== null
  const showThermal =
    thermalEnabled &&
    thermal !== null &&
    Object.values(thermal).some((value) => typeof value === 'number')

  if (!showGamepad && !showLight && !showThermal) return null

  const label = name ?? t('bluetoothDeviceConnected')

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {showGamepad && (
        <div className="flex items-center gap-2" title={label}>
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
      )}
      {showLight && (
        <div
          className="flex items-center gap-1.5"
          title={t('illuminance')}
          aria-label={`${t('illuminance')}: ${light.lux.toFixed(0)} ${t('luxUnit')}`}
        >
          <Sun className="size-4 text-osd-primary" aria-hidden="true" />
          <span className="font-mono text-osd-sm tabular-nums text-osd-primary">
            {light.lux.toFixed(0)} {t('luxUnit')}
          </span>
        </div>
      )}
      {showThermal &&
        Object.entries(thermal)
          .filter(([, value]) => typeof value === 'number')
          .map(([key, value]) => (
            <Badge key={key} tone="warning">
              {t(`thermal.${key}`, { defaultValue: key })}: {(value as number).toFixed(1)}°C
            </Badge>
          ))}
    </div>
  )
}
