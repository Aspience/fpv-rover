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
  pingMs: number | null
  lastPingTs: number | null
  updateFromModules: (modules: {
    power?: PowerData
    light?: LightData
    imu?: ImuData
    thermal?: ThermalData
    bluetooth?: BluetoothData
  }) => void
  recordPing: (clientTs: number) => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  power: null,
  light: null,
  imu: null,
  thermal: null,
  bluetooth: null,
  pitch: 0,
  roll: 0,
  pingMs: null,
  lastPingTs: null,
  recordPing: (clientTs) =>
    set((state) => {
      // The backend repeats the same client_ts across telemetry frames until
      // the next heartbeat, so only measure RTT once per distinct value.
      if (clientTs === state.lastPingTs) return state
      return {
        lastPingTs: clientTs,
        pingMs: Math.max(0, Math.round(Date.now() - clientTs)),
      }
    }),
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
