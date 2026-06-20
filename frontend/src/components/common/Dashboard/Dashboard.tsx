import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { sendBrightness } from '@/api/websocket'
import { Slider } from '@/components/ui'
import { useControlStore } from '@/store/controlStore'
import { useSystemStore } from '@/store/systemStore'

import './Dashboard.css'

export const Dashboard = () => {
  const { t } = useTranslation()
  const modules = useSystemStore((s) => s.modules)
  const brightness = useControlStore((s) => s.brightness)
  const setBrightness = useControlStore((s) => s.setBrightness)

  if (!modules.light) return null

  return (
    <div className="dashboard">
      <div className="dashboard__controls">
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
      </div>
    </div>
  )
}
