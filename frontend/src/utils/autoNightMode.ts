import {
  AUTO_NIGHT_MODE_STORAGE_KEY,
  NIGHT_MODE_THRESHOLD_DEFAULT,
} from '@/constants'

export interface AutoNightModePreference {
  enabled: boolean
  thresholdLux: number
}

const defaultPreference = (): AutoNightModePreference => ({
  enabled: false,
  thresholdLux: NIGHT_MODE_THRESHOLD_DEFAULT,
})

const isAutoNightModePreference = (
  value: unknown,
): value is AutoNightModePreference => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.enabled === 'boolean' &&
    typeof record.thresholdLux === 'number' &&
    Number.isFinite(record.thresholdLux)
  )
}

export const getAutoNightModePreference = (): AutoNightModePreference => {
  try {
    const raw = localStorage.getItem(AUTO_NIGHT_MODE_STORAGE_KEY)
    if (!raw) return defaultPreference()
    const parsed: unknown = JSON.parse(raw)
    if (!isAutoNightModePreference(parsed)) return defaultPreference()
    return parsed
  } catch {
    return defaultPreference()
  }
}

export const setAutoNightModePreference = (
  preference: AutoNightModePreference,
): void => {
  try {
    localStorage.setItem(AUTO_NIGHT_MODE_STORAGE_KEY, JSON.stringify(preference))
  } catch {
    // ignore persistence errors
  }
}
