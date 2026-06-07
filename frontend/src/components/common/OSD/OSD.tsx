import { Battery } from './Battery'
import { Crosshair } from './Crosshair'
import { Horizon } from './Horizon'
import { ThermalBadges } from './ThermalBadges'

import './OSD.css'

export const OSD = () => {
  return (
    <div className="osd">
      <Crosshair />
      <Horizon />
      <Battery />
      <ThermalBadges />
    </div>
  )
}
