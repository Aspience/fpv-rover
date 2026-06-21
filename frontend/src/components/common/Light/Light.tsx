import { clsx } from 'clsx'
import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { sendBrightness } from '@/api/websocket'
import { Slider } from '@/components/ui'
import { useControlStore } from '@/store/controlStore'

interface LightProps {
  className?: string
}

export const Light = ({ className = '' }: LightProps) => {
  const { t } = useTranslation()
  const brightness = useControlStore((s) => s.brightness)
  const setBrightness = useControlStore((s) => s.setBrightness)

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-3 rounded-lg border border-osd-primary/30 bg-osd-panel p-4 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex min-w-48 items-center gap-2">
          <Lightbulb className="size-4 shrink-0 text-osd-primary" />
          <Slider
            className="w-full"
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
