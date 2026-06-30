import { create } from 'zustand'

import type {
  BluetoothData,
  ImuData,
  LightData,
  PowerData,
  ThermalData,
} from '@/types/contracts'
import { attitudeFromImu } from '@/utils/telemetry'

interface TelemetryState {
  power: PowerData | null
  light: LightData | null
  imu: ImuData | null
  thermal: ThermalData | null
  bluetooth: BluetoothData | null
  pitch: number
  roll: number
  updateFromModules: (modules: {
    power?: PowerData
    light?: LightData
    imu?: ImuData
    thermal?: ThermalData
    bluetooth?: BluetoothData
  }) => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  power: null,
  light: null,
  imu: null,
  thermal: null,
  bluetooth: null,
  pitch: 0,
  roll: 0,
  updateFromModules: (modules) =>
    set((state) => {
      const next = { ...state }
      if (modules.power) next.power = modules.power
      if (modules.light) next.light = modules.light
      if (modules.thermal) next.thermal = modules.thermal
      if (modules.bluetooth) next.bluetooth = modules.bluetooth
      if (modules.imu) {
        next.imu = modules.imu
        const attitude = attitudeFromImu(modules.imu)
        next.pitch = attitude.pitch
        next.roll = attitude.roll
      }
      return next
    }),
}))
