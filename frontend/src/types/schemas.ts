import { z } from 'zod'

const powerDataSchema = z.object({
  voltage_v: z.number(),
  current_a: z.number(),
})

const motionDataSchema = z.object({
  steering_pos: z.number(),
})

const lightDataSchema = z.object({
  lux: z.number(),
})

const imuDataSchema = z.object({
  ax_g: z.number(),
  ay_g: z.number(),
  az_g: z.number(),
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
  modules: z.object({
    power: powerDataSchema.optional(),
    motion: motionDataSchema.optional(),
    light: lightDataSchema.optional(),
    thermal: thermalDataSchema.optional(),
    imu: imuDataSchema.optional(),
  }),
})

export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
})

export const HeartbeatCommandSchema = z.object({
  cmd: z.literal('heartbeat'),
})

export const MoveCommandSchema = z.object({
  cmd: z.literal('move'),
  pwm_left: z.number().int().min(0).max(100),
  pwm_right: z.number().int().min(0).max(100),
  steer: z.number().min(-1).max(1).optional(),
})

export const SetBrightnessCommandSchema = z.object({
  cmd: z.literal('set_brightness'),
  level: z.number().int().min(0).max(100),
})

export const ClientCommandSchema = z.discriminatedUnion('cmd', [
  HeartbeatCommandSchema,
  MoveCommandSchema,
  SetBrightnessCommandSchema,
])

export const ConfigResponseSchema = z.object({
  modules: z.object({
    power: z.boolean(),
    motion: z.boolean(),
    thermal: z.boolean(),
    imu: z.boolean(),
    light: z.boolean(),
    camera: z.boolean(),
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
