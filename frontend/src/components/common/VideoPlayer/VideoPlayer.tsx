import { clsx } from 'clsx'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { connectWhep } from '@/api/webrtc'
import { useSystemStore } from '@/store/systemStore'

interface VideoPlayerProps {
  className?: string
}

export const VideoPlayer = ({ className = '' }: VideoPlayerProps) => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraEnabled = useSystemStore((s) => s.modules.camera)
  const videoNonce = useSystemStore((s) => s.videoNonce)

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
  }, [cameraEnabled, videoNonce])

  if (!cameraEnabled) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center bg-black text-osd-muted',
          className,
        )}
      >
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
      className={clsx('h-full w-full object-cover', className)}
    />
  )
}
