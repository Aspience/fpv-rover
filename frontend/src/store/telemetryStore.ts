import { create } from 'zustand'

import type { ImuData, LightData, PowerData, ThermalData } from '@/types/contracts'

interface TelemetryState {
  power: PowerData | null
  light: LightData | null
  imu: ImuData | null
  thermal: ThermalData | null
  pitch: number
  roll: number
  updateFromModules: (modules: {
    power?: PowerData
    light?: LightData
    imu?: ImuData
    thermal?: ThermalData
  }) => void
}

const attitudeFromImu = (imu: ImuData): { pitch: number; roll: number } => {
  const pitch = (Math.atan2(imu.ay_g, imu.az_g) * 180) / Math.PI
  const roll = (Math.atan2(-imu.ax_g, imu.az_g) * 180) / Math.PI
  return { pitch, roll }
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  power: null,
  light: null,
  imu: null,
  thermal: null,
  pitch: 0,
  roll: 0,
  updateFromModules: (modules) =>
    set((state) => {
      const next = { ...state }
      if (modules.power) next.power = modules.power
      if (modules.light) next.light = modules.light
      if (modules.thermal) next.thermal = modules.thermal
      if (modules.imu) {
        next.imu = modules.imu
        const attitude = attitudeFromImu(modules.imu)
        next.pitch = attitude.pitch
        next.roll = attitude.roll
      }
      return next
    }),
}))
