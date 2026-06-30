export interface ModulesConfig {
  power: boolean
  motion: boolean
  thermal: boolean
  imu: boolean
  light: boolean
  camera: boolean
  bluetooth: boolean
}

export interface ConfigResponse {
  modules: ModulesConfig
}

export interface ServiceVersions {
  backend: string
  frontend: string
  mediamtx: string
}

export interface HealthResponse {
  status: string
  version: string
  services: ServiceVersions
}

export interface UpdateCheckResponse {
  current: string
  latest: string | null
  has_update: boolean
}

export interface UpdateApplyResponse {
  status: string
}

export interface CameraStreamConfig {
  width: number
  height: number
  bitrate: number
}

export interface CameraStreamConfigResponse {
  status: string
}

export type OtaStatus =
  | 'idle'
  | 'checking'
  | 'update_available'
  | 'updating'
  | 'success'
  | 'error'

export interface PowerData {
  voltage_v: number
  current_a: number
}

export interface MotionData {
  steering_pos: number
}

export interface LightData {
  lux: number
}

export interface ImuData {
  ax_g: number
  ay_g: number
  az_g: number
}

export interface BluetoothData {
  connected: boolean
  name: string | null
  mac: string | null
}

export interface BluetoothDevice {
  mac: string
  name: string
  connected: boolean
}

export interface BluetoothActionResponse {
  status: string
}

export interface ThermalData {
  motor_steering?: number
  motor_front?: number
  motor_rear?: number
  bms?: number
  iflight_bec?: number
  tp5100?: number
  [key: string]: number | undefined
}

export interface TelemetryModules {
  power?: PowerData
  motion?: MotionData
  light?: LightData
  thermal?: ThermalData
  imu?: ImuData
  bluetooth?: BluetoothData
}

export interface TelemetryMessage {
  type: 'telemetry'
  modules: TelemetryModules
}

export interface HeartbeatCommand {
  cmd: 'heartbeat'
}

export interface MoveCommand {
  cmd: 'move'
  pwm_left: number
  pwm_right: number
  steer?: number
}

export interface SetBrightnessCommand {
  cmd: 'set_brightness'
  level: number
}

export type ClientCommand =
  | HeartbeatCommand
  | MoveCommand
  | SetBrightnessCommand

export interface ErrorMessage {
  type: 'error'
  message: string
}
