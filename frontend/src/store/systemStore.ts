import { create } from 'zustand'

import type { ModulesConfig } from '@/types/contracts'

interface SystemState {
  modules: ModulesConfig
  wsConnected: boolean
  videoConnected: boolean
  configLoaded: boolean
  setModules: (modules: ModulesConfig) => void
  setWsConnected: (connected: boolean) => void
  setVideoConnected: (connected: boolean) => void
  setConfigLoaded: (loaded: boolean) => void
}

const defaultModules: ModulesConfig = {
  power: false,
  motion: false,
  thermal: false,
  imu: false,
  light: false,
  camera: false,
}

export const useSystemStore = create<SystemState>((set) => ({
  modules: defaultModules,
  wsConnected: false,
  videoConnected: false,
  configLoaded: false,
  setModules: (modules) => set({ modules }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setVideoConnected: (videoConnected) => set({ videoConnected }),
  setConfigLoaded: (configLoaded) => set({ configLoaded }),
}))
