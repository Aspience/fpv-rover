import { create } from 'zustand'

interface ControlState {
  pwmLeft: number
  pwmRight: number
  brightness: number
  setPwm: (left: number, right: number) => void
  setBrightness: (level: number) => void
}

export const useControlStore = create<ControlState>((set) => ({
  pwmLeft: 0,
  pwmRight: 0,
  brightness: 0,
  setPwm: (pwmLeft, pwmRight) => set({ pwmLeft, pwmRight }),
  setBrightness: (brightness) => set({ brightness }),
}))
