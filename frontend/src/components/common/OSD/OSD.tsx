import { Battery } from './Battery'
import { Crosshair } from './Crosshair'
import { Horizon } from './Horizon'
import { ThermalBadges } from './ThermalBadges'

interface OSDProps {
  className?: string
}

export const OSD = ({ className = '' }: OSDProps) => {
  return (
    <div className={className}>
      <Crosshair />
      <Horizon />
      <Battery />
      <ThermalBadges />
    </div>
  )
}
