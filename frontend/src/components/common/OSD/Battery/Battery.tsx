import { Badge } from '@/components/ui'
import { useTelemetryStore } from '@/store/telemetryStore'
import { useSystemStore } from '@/store/systemStore'

import './Battery.css'

const batteryTone = (voltage: number): 'primary' | 'warning' | 'danger' => {
  if (voltage >= 7.2) return 'primary'
  if (voltage >= 6.5) return 'warning'
  return 'danger'
}

export const Battery = () => {
  const powerEnabled = useSystemStore((s) => s.modules.power)
  const power = useTelemetryStore((s) => s.power)

  if (!powerEnabled || !power) return null

  const tone = batteryTone(power.voltage_v)

  return (
    <div className="battery">
      <Badge tone={tone}>{power.voltage_v.toFixed(2)} V</Badge>
      <Badge tone="muted">{power.current_a.toFixed(2)} A</Badge>
    </div>
  )
}
