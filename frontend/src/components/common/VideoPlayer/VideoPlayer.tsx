import { clsx } from 'clsx'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { connectWhep } from '@/api/webrtc'
import { useSystemStore } from '@/store/systemStore'

import './VideoPlayer.css'

interface VideoPlayerProps {
  className?: string
}

export const VideoPlayer = ({ className = '' }: VideoPlayerProps) => {
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
      <div className={clsx('video-player__placeholder', className)}>
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
      className={clsx('video-player', className)}
    />
  )
}
