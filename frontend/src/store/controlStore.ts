import { create } from 'zustand'

import { sendMove } from '@/api/websocket'

interface ControlState {
  throttleLocal: number
  steerDegLocal: number
  isDraggingThrottle: boolean
  isDraggingSteer: boolean
  throttleRemote: number | null
  steerDegRemote: number | null
  brightness: number
  setThrottleLocal: (value: number, steerDeg: number) => void
  setSteerDegLocal: (value: number, throttle: number) => void
  setDraggingThrottle: (dragging: boolean) => void
  setDraggingSteer: (dragging: boolean) => void
  reconcileFromTelemetry: (throttle: number, steerDeg: number) => void
  setBrightness: (level: number) => void
}

export const useControlStore = create<ControlState>((set, get) => ({
  throttleLocal: 0,
  steerDegLocal: 0,
  isDraggingThrottle: false,
  isDraggingSteer: false,
  throttleRemote: null,
  steerDegRemote: null,
  brightness: 0,
  setThrottleLocal: (throttleLocal, steerDeg) => {
    set({ throttleLocal })
    sendMove(throttleLocal, steerDeg)
  },
  setSteerDegLocal: (steerDegLocal, throttle) => {
    set({ steerDegLocal })
    sendMove(throttle, steerDegLocal)
  },
  setDraggingThrottle: (isDraggingThrottle) => set({ isDraggingThrottle }),
  setDraggingSteer: (isDraggingSteer) => set({ isDraggingSteer }),
  reconcileFromTelemetry: (throttle, steerDeg) => {
    const state = get()
    if (state.isDraggingThrottle || state.isDraggingSteer) {
      set({ throttleRemote: throttle, steerDegRemote: steerDeg })
      return
    }
    set({
      throttleRemote: throttle,
      steerDegRemote: steerDeg,
      throttleLocal: throttle,
      steerDegLocal: steerDeg,
    })
  },
  setBrightness: (brightness) => set({ brightness }),
}))
