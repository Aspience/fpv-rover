import type { SelectOption } from '@/components/ui'

interface ResolutionPreset {
  value: string
  label: string
  width: number
  height: number
}

const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { value: '426x240', label: '240p', width: 426, height: 240 },
  { value: '640x360', label: '360p', width: 640, height: 360 },
  { value: '854x480', label: '480p', width: 854, height: 480 },
  { value: '1280x720', label: '720p', width: 1280, height: 720 },
  { value: '1920x1080', label: '1080p', width: 1920, height: 1080 },
]

const BITRATE_MIN_KBPS = 500
const BITRATE_MAX_KBPS = 5000
const BITRATE_STEP_KBPS = 250

export const DEFAULT_RESOLUTION = '1280x720'
export const DEFAULT_BITRATE_BPS = 2000 * 1000

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
