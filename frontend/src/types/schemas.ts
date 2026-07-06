import { z } from 'zod'

const powerDataSchema = z.object({
  voltage_v: z.number(),
  current_a: z.number(),
})

const motionDataSchema = z.object({
  steering_pos: z.number(),
  throttle_applied: z.number().default(0),
  steer_deg_applied: z.number().default(0),
  calibrating: z.boolean().default(false),
  calibration_error: z.string().nullable().default(null),
  front_speed: z.number().default(0),
  rear_speed: z.number().default(0),
})

const gamepadDataSchema = z.object({
  connected: z.boolean(),
  name: z.string().nullable(),
  device_path: z.string().nullable(),
})

const lightDataSchema = z.object({
  lux: z.number(),
})

const imuDataSchema = z.object({
  ax_g: z.number(),
  ay_g: z.number(),
  az_g: z.number(),
})

const bluetoothDataSchema = z.object({
  connected: z.boolean(),
  name: z.string().nullable(),
  mac: z.string().nullable(),
})

const thermalDataSchema = z
  .object({
    motor_steering: z.number().optional(),
    motor_front: z.number().optional(),
    motor_rear: z.number().optional(),
    bms: z.number().optional(),
    iflight_bec: z.number().optional(),
    tp5100: z.number().optional(),
  })
  .catchall(z.number().optional())

export const TelemetryMessageSchema = z.object({
  type: z.literal('telemetry'),
  client_ts: z.number().nullable(),
  modules: z.object({
    power: powerDataSchema.optional(),
    motion: motionDataSchema.optional(),
    light: lightDataSchema.optional(),
    thermal: thermalDataSchema.optional(),
    imu: imuDataSchema.optional(),
    bluetooth: bluetoothDataSchema.optional(),
    gamepad: gamepadDataSchema.optional(),
  }),
})

export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
})

export const HeartbeatCommandSchema = z.object({
  cmd: z.literal('heartbeat'),
  ts: z.number().optional(),
})

export const MoveCommandSchema = z.object({
  cmd: z.literal('move'),
  throttle: z.number().int().min(-100).max(100),
  steer_deg: z.number().optional(),
})

export const CalibrateCommandSchema = z.object({
  cmd: z.literal('calibrate'),
})

export const SetBrightnessCommandSchema = z.object({
  cmd: z.literal('set_brightness'),
  level: z.number().int().min(0).max(100),
})

export const SetAutoNightModeCommandSchema = z.object({
  cmd: z.literal('set_auto_night_mode'),
  enabled: z.boolean(),
  threshold_lux: z.number().min(1).max(65535),
})

export const ClientCommandSchema = z.discriminatedUnion('cmd', [
  HeartbeatCommandSchema,
  MoveCommandSchema,
  CalibrateCommandSchema,
  SetBrightnessCommandSchema,
  SetAutoNightModeCommandSchema,
])

export const ConfigResponseSchema = z.object({
  modules: z.object({
    power: z.boolean(),
    motion: z.boolean(),
    thermal: z.boolean(),
    imu: z.boolean(),
    light: z.boolean(),
    camera: z.boolean(),
    bluetooth: z.boolean(),
    gamepad: z.boolean(),
  }),
})

export const ServiceVersionsSchema = z.object({
  backend: z.string(),
  frontend: z.string(),
  mediamtx: z.string(),
})

export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  services: ServiceVersionsSchema,
})

export const UpdateCheckResponseSchema = z.object({
  current: z.string(),
  latest: z.string().nullable(),
  has_update: z.boolean(),
})

export const UpdateApplyResponseSchema = z.object({
  status: z.string(),
})

export const CameraStreamConfigResponseSchema = z.object({
  status: z.string(),
})

export const CameraStreamConfigSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bitrate: z.number().int().positive(),
})

export const BluetoothDeviceSchema = z.object({
  mac: z.string(),
  name: z.string(),
  connected: z.boolean(),
})

export const BluetoothDeviceListSchema = z.array(BluetoothDeviceSchema)

export const BluetoothActionResponseSchema = z.object({
  status: z.string(),
})
