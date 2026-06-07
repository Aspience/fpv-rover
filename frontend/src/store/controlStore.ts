import { create } from 'zustand'

interface ControlState {
  pwmLeft: number
  pwmRight: number
  brightness: number
  recording: boolean
  setPwm: (left: number, right: number) => void
  setBrightness: (level: number) => void
  setRecording: (recording: boolean) => void
}

export const useControlStore = create<ControlState>((set) => ({
  pwmLeft: 0,
  pwmRight: 0,
  brightness: 0,
  recording: false,
  setPwm: (pwmLeft, pwmRight) => set({ pwmLeft, pwmRight }),
  setBrightness: (brightness) => set({ brightness }),
  setRecording: (recording) => set({ recording }),
}))
