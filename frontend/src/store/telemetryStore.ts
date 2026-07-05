import { create } from 'zustand'

import type {
  BluetoothData,
  GamepadData,
  ImuData,
  LightData,
  MotionData,
  PowerData,
  ThermalData,
} from '@/types/contracts'
import { useControlStore } from '@/store/controlStore'
import { attitudeFromImu } from '@/utils/telemetry'

interface TelemetryState {
  power: PowerData | null
  motion: MotionData | null
  light: LightData | null
  imu: ImuData | null
  thermal: ThermalData | null
  bluetooth: BluetoothData | null
  gamepad: GamepadData | null
  pitch: number
  roll: number
  pingMs: number | null
  lastPingTs: number | null
  updateFromModules: (modules: {
    power?: PowerData
    motion?: MotionData
    light?: LightData
    imu?: ImuData
    thermal?: ThermalData
    bluetooth?: BluetoothData
    gamepad?: GamepadData
  }) => void
  recordPing: (clientTs: number) => void
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  power: null,
  motion: null,
  light: null,
  imu: null,
  thermal: null,
  bluetooth: null,
  gamepad: null,
  pitch: 0,
  roll: 0,
  pingMs: null,
  lastPingTs: null,
  recordPing: (clientTs) =>
    set((state) => {
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
      if (modules.gamepad) next.gamepad = modules.gamepad
      if (modules.motion) {
        next.motion = modules.motion
        useControlStore.getState().reconcileFromTelemetry(
          modules.motion.throttle_applied,
          modules.motion.steer_deg_applied,
        )
      }
      if (modules.imu) {
        next.imu = modules.imu
        const attitude = attitudeFromImu(modules.imu)
        next.pitch = attitude.pitch
        next.roll = attitude.roll
      }
      return next
    }),
}))
