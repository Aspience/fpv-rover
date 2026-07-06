import { Battery } from './Battery'
import { Crosshair } from './Crosshair'
import { Horizon } from './Horizon'

interface OSDProps {
  className?: string
}

export const OSD = ({ className = '' }: OSDProps) => {
  return (
    <div className={className}>
      <Crosshair className="absolute inset-0" />
      <Horizon className="absolute inset-0" />
      <Battery className="absolute top-4 left-4" />
    </div>
  )
}
