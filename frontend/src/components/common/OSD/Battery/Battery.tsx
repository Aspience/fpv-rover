import { clsx } from 'clsx'

import { Badge } from '@/components/ui'
import { useTelemetryStore } from '@/store/telemetryStore'
import { useSystemStore } from '@/store/systemStore'
import { batteryTone } from '@/utils'

interface BatteryProps {
  className?: string
}

export const Battery = ({ className = '' }: BatteryProps) => {
  const powerEnabled = useSystemStore((s) => s.modules.power)
  const power = useTelemetryStore((s) => s.power)

  if (!powerEnabled || !power) return null

  const tone = batteryTone(power.voltage_v)

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <Badge tone={tone}>{power.voltage_v.toFixed(2)} V</Badge>
      <Badge tone="muted">{power.current_a.toFixed(2)} A</Badge>
    </div>
  )
}
