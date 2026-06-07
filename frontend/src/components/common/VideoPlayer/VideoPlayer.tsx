import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { connectWhep } from '@/api/webrtc'
import { useSystemStore } from '@/store/systemStore'

import './VideoPlayer.css'

export const VideoPlayer = () => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraEnabled = useSystemStore((s) => s.modules.camera)

  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) return

    let cleanup: (() => void) | undefined
    connectWhep(videoRef.current)
      .then((stop) => {
        cleanup = stop
      })
      .catch(() => {
        useSystemStore.getState().setVideoConnected(false)
      })

    return () => {
      cleanup?.()
    }
  }, [cameraEnabled])

  if (!cameraEnabled) {
    return (
      <div className="video-player__placeholder">
        {t('cameraDisabled')}
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="video-player"
    />
  )
}
