import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui'
import { useTelemetryStore } from '@/store/telemetryStore'
import { useSystemStore } from '@/store/systemStore'

interface ThermalBadgesProps {
  className?: string
}

export const ThermalBadges = ({ className = '' }: ThermalBadgesProps) => {
  const { t } = useTranslation()
  const thermalEnabled = useSystemStore((s) => s.modules.thermal)
  const thermal = useTelemetryStore((s) => s.thermal)
  const lightEnabled = useSystemStore((s) => s.modules.light)
  const light = useTelemetryStore((s) => s.light)

  if (!thermalEnabled && !lightEnabled) return null

  return (
    <div className={clsx('flex max-w-80 flex-col items-end gap-1', className)}>
      {lightEnabled && light ? (
        <Badge tone="muted">{light.lux.toFixed(0)} lux</Badge>
      ) : null}
      {thermalEnabled && thermal
        ? Object.entries(thermal)
            .filter(([, value]) => typeof value === 'number')
            .map(([key, value]) => (
              <Badge key={key} tone="warning">
                {t(`thermal.${key}`, { defaultValue: key })}:{' '}
                {(value as number).toFixed(1)}°C
              </Badge>
            ))
        : null}
    </div>
  )
}
