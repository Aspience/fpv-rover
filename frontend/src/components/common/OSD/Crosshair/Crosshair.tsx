import { clsx } from 'clsx'

import { selectCameraReady } from '@/store/selectors'
import { useSystemStore } from '@/store/systemStore'

interface CrosshairProps {
  className?: string
}

export const Crosshair = ({ className = '' }: CrosshairProps) => {
  const cameraAvailable = useSystemStore(selectCameraReady)

  if (!cameraAvailable) return null

  return (
    <div className={clsx('pointer-events-none flex items-center justify-center', className)}>
      <div className="relative size-16">
        <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-osd-primary/70" />
        <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-osd-primary/70" />
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-osd-primary" />
      </div>
    </div>
  )
}
