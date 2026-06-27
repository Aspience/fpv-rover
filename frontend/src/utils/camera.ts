import {
  BITRATE_MAX_KBPS,
  BITRATE_MIN_KBPS,
  BITRATE_STEP_KBPS,
  RESOLUTION_PRESETS,
} from '@/constants'
import type { SelectOption } from '@/components/ui'

export const getCameraResolutionOptions = (): SelectOption[] =>
  RESOLUTION_PRESETS.map(({ value, label }) => ({ value, label }))

export const getCameraBitrateOptions = (): SelectOption[] => {
  const options: SelectOption[] = []
  for (let kbps = BITRATE_MIN_KBPS; kbps <= BITRATE_MAX_KBPS; kbps += BITRATE_STEP_KBPS) {
    options.push({ value: String(kbps * 1000), label: `${kbps} kbps` })
  }
  return options
}

export const parseResolution = (value: string): { width: number; height: number } => {
  const preset = RESOLUTION_PRESETS.find((item) => item.value === value)
  if (preset) return { width: preset.width, height: preset.height }

  const [width, height] = value.split('x').map(Number)
  return { width: width || 0, height: height || 0 }
}

export const formatResolution = (width: number, height: number): string => {
  const preset = RESOLUTION_PRESETS.find(
    (item) => item.width === width && item.height === height,
  )
  return preset ? preset.value : `${width}x${height}`
}
