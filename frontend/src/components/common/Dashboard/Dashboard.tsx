import { Circle, Lightbulb, Video } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { sendBrightness, sendRecord } from '@/api/websocket'
import { Button, Slider } from '@/components/ui'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'

import './Dashboard.css'

export const Dashboard = () => {
  const { t } = useTranslation()
  const modules = useSystemStore((s) => s.modules)
  const brightness = useControlStore((s) => s.brightness)
  const recording = useControlStore((s) => s.recording)
  const setBrightness = useControlStore((s) => s.setBrightness)
  const setRecording = useControlStore((s) => s.setRecording)

  const hasControls = modules.light || modules.camera
  if (!hasControls) return null

  return (
    <div className="dashboard">
      <div className="dashboard__controls">
        {modules.light ? (
          <div className="dashboard__light">
            <Lightbulb className="dashboard__icon" />
            <Slider
              label={t('light')}
              min={0}
              max={100}
              value={brightness}
              onChange={(event) => {
                const level = Number(event.target.value)
                setBrightness(level)
                sendBrightness(level)
              }}
            />
          </div>
        ) : null}

        {modules.camera ? (
          <Button
            variant={recording ? 'danger' : 'ghost'}
            onClick={() => {
              const next = !recording
              setRecording(next)
              sendRecord(next ? 'start' : 'stop')
            }}
          >
            <span className="dashboard__button-content">
              {recording ? (
                <Circle className="dashboard__record-icon" />
              ) : (
                <Video className="dashboard__video-icon" />
              )}
              {recording ? t('stopRec') : t('record')}
            </span>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
