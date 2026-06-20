import { selectCameraReady } from '@/store/selectors'
import { useSystemStore } from '@/store/systemStore'

import './Crosshair.css'

export const Crosshair = () => {
  const cameraAvailable = useSystemStore(selectCameraReady)

  if (!cameraAvailable) return null

  return (
    <div className="crosshair">
      <div className="crosshair__reticle">
        <span className="crosshair__line-v" />
        <span className="crosshair__line-h" />
        <span className="crosshair__dot" />
      </div>
    </div>
  )
}
