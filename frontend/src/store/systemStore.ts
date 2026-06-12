import { create } from 'zustand'

import { fetchConfig } from '@/api/config'
import { pingHealth } from '@/api/health'
import { applyUpdate, checkUpdate } from '@/api/update'
import type { ModulesConfig, OtaStatus } from '@/types/contracts'

const OTA_POLL_MS = 3000
const OTA_POLL_TIMEOUT_MS = 5 * 60 * 1000

let otaPollInterval: ReturnType<typeof setInterval> | null = null
let otaPollStartedAt = 0

interface SystemState {
  modules: ModulesConfig
  wsConnected: boolean
  videoConnected: boolean
  configLoaded: boolean
  otaStatus: OtaStatus
  versions: { current: string | null; latest: string | null }
  otaError: string | null
  setModules: (modules: ModulesConfig) => void
  setWsConnected: (connected: boolean) => void
  setVideoConnected: (connected: boolean) => void
  setConfigLoaded: (loaded: boolean) => void
  checkForUpdate: () => Promise<void>
  applyOtaUpdate: () => Promise<void>
  startOtaPolling: () => void
  stopOtaPolling: () => void
  resetOtaStatus: () => void
}

const defaultModules: ModulesConfig = {
  power: false,
  motion: false,
  thermal: false,
  imu: false,
  light: false,
  camera: false,
}

export const useSystemStore = create<SystemState>((set, get) => ({
  modules: defaultModules,
  wsConnected: false,
  videoConnected: false,
  configLoaded: false,
  otaStatus: 'idle',
  versions: { current: null, latest: null },
  otaError: null,
  setModules: (modules) => set({ modules }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setVideoConnected: (videoConnected) => set({ videoConnected }),
  setConfigLoaded: (configLoaded) => set({ configLoaded }),
  checkForUpdate: async () => {
    set({ otaStatus: 'checking', otaError: null })
    try {
      const result = await checkUpdate()
      set({
        versions: { current: result.current, latest: result.latest },
        otaStatus: result.has_update ? 'update_available' : 'idle',
      })
    } catch (error) {
      set({
        otaStatus: 'error',
        otaError: error instanceof Error ? error.message : 'Update check failed',
      })
    }
  },
  applyOtaUpdate: async () => {
    set({ otaStatus: 'updating', otaError: null })
    try {
      await applyUpdate()
      get().startOtaPolling()
    } catch (error) {
      set({
        otaStatus: 'error',
        otaError: error instanceof Error ? error.message : 'Update apply failed',
      })
    }
  },
  startOtaPolling: () => {
    get().stopOtaPolling()
    otaPollStartedAt = Date.now()

    otaPollInterval = setInterval(() => {
      if (Date.now() - otaPollStartedAt > OTA_POLL_TIMEOUT_MS) {
        get().stopOtaPolling()
        set({
          otaStatus: 'error',
          otaError: 'Update timed out waiting for rover to come back online',
        })
        return
      }

      void pingHealth()
        .then((health) => {
          get().stopOtaPolling()
          set({
            otaStatus: 'success',
            versions: {
              current: health.version,
              latest: get().versions.latest,
            },
          })
          void fetchConfig().catch(() => undefined)
        })
        .catch(() => undefined)
    }, OTA_POLL_MS)
  },
  stopOtaPolling: () => {
    if (otaPollInterval !== null) {
      clearInterval(otaPollInterval)
      otaPollInterval = null
    }
  },
  resetOtaStatus: () => {
    get().stopOtaPolling()
    set({ otaStatus: 'idle', otaError: null })
  },
}))
