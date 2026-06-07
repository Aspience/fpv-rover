import { useTelemetryStore } from '@/store/telemetryStore'
import { useSystemStore } from '@/store/systemStore'

import './Horizon.css'

export const Horizon = () => {
  const imuEnabled = useSystemStore((s) => s.modules.imu)
  const pitch = useTelemetryStore((s) => s.pitch)
  const roll = useTelemetryStore((s) => s.roll)

  if (!imuEnabled) return null

  return (
    <div className="horizon">
      <svg
        viewBox="0 0 200 200"
        className="horizon__svg"
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
      <div className="horizon__readout">
        P {pitch.toFixed(1)}° R {roll.toFixed(1)}°
      </div>
    </div>
  )
}
