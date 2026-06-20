import type { SystemState } from './systemStore'

export const selectCameraReady = (s: SystemState) =>
  s.modules.camera && s.videoConnected
