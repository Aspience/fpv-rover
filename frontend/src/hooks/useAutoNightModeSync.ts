import { useEffect } from 'react'

import { sendAutoNightMode } from '@/api/websocket'
import { useSystemStore } from '@/store/systemStore'
import { getAutoNightModePreference } from '@/utils/autoNightMode'

/**
 * Pushes saved auto night mode settings to the backend whenever the WebSocket
 * connects while the light module is enabled.
 */
export const useAutoNightModeSync = (): void => {
  const wsConnected = useSystemStore((state) => state.wsConnected)
  const lightEnabled = useSystemStore((state) => state.modules.light)

  useEffect(() => {
    if (!wsConnected || !lightEnabled) return
    const preference = getAutoNightModePreference()
    sendAutoNightMode(preference.enabled, preference.thresholdLux)
  }, [lightEnabled, wsConnected])
}
