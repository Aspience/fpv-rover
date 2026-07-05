import { create } from 'zustand'

import type { ModulesConfig, OtaStatus } from '@/types/contracts'

export interface SystemState {
  modules: ModulesConfig
  wsConnected: boolean
  videoConnected: boolean
  videoNonce: number
  configLoaded: boolean
  otaStatus: OtaStatus
  setModules: (modules: ModulesConfig) => void
  setWsConnected: (connected: boolean) => void
  setVideoConnected: (connected: boolean) => void
  reconnectVideo: () => void
  setConfigLoaded: (loaded: boolean) => void
  setOtaStatus: (status: OtaStatus) => void
  resetOtaStatus: () => void
}

const defaultModules: ModulesConfig = {
  power: false,
  motion: false,
  thermal: false,
  imu: false,
  light: false,
  camera: false,
  bluetooth: false,
  gamepad: false,
}

export const useSystemStore = create<SystemState>((set) => ({
  modules: defaultModules,
  wsConnected: false,
  videoConnected: false,
  videoNonce: 0,
  configLoaded: false,
  otaStatus: 'idle',
  setModules: (modules) => set({ modules }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setVideoConnected: (videoConnected) => set({ videoConnected }),
  reconnectVideo: () => set((state) => ({ videoNonce: state.videoNonce + 1 })),
  setConfigLoaded: (configLoaded) => set({ configLoaded }),
  setOtaStatus: (otaStatus) => set({ otaStatus }),
  resetOtaStatus: () => set({ otaStatus: 'idle' }),
}))
