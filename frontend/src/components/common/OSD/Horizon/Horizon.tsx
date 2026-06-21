import { clsx } from 'clsx'

import { useTelemetryStore } from '@/store/telemetryStore'
import { useSystemStore } from '@/store/systemStore'

interface HorizonProps {
  className?: string
}

export const Horizon = ({ className = '' }: HorizonProps) => {
  const imuEnabled = useSystemStore((s) => s.modules.imu)
  const pitch = useTelemetryStore((s) => s.pitch)
  const roll = useTelemetryStore((s) => s.roll)

  if (!imuEnabled) return null

  return (
    <div className={clsx('pointer-events-none flex items-center justify-center', className)}>
      <svg
        viewBox="0 0 200 200"
        className="size-48 text-osd-primary"
        style={{ transform: `rotate(${roll}deg)` }}
        aria-hidden
      >
        <g transform={`translate(0 ${pitch * 1.5})`}>
          <line x1="20" y1="100" x2="80" y2="100" stroke="currentColor" strokeWidth="2" />
          <line x1="120" y1="100" x2="180" y2="100" stroke="currentColor" strokeWidth="2" />
          <polygon points="100,88 94,100 106,100" fill="currentColor" />
          <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        </g>
      </svg>
      <div className="absolute bottom-1/2 mb-24 text-osd-xs text-osd-muted">
        P {pitch.toFixed(1)}° R {roll.toFixed(1)}°
      </div>
    </div>
  )
}
