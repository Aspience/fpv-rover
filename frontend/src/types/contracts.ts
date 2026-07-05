export interface ModulesConfig {
  power: boolean
  motion: boolean
  thermal: boolean
  imu: boolean
  light: boolean
  camera: boolean
  bluetooth: boolean
  gamepad: boolean
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
  throttle_applied: number
  steer_deg_applied: number
  calibrating: boolean
  calibration_error: string | null
  front_speed: number
  rear_speed: number
}

export interface GamepadData {
  connected: boolean
  name: string | null
  device_path: string | null
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
  gamepad?: GamepadData
}

export interface TelemetryMessage {
  type: 'telemetry'
  modules: TelemetryModules
  /** Echo of the last client heartbeat timestamp (epoch ms) for ping. */
  client_ts: number | null
}

export interface HeartbeatCommand {
  cmd: 'heartbeat'
  /** Client epoch milliseconds, echoed back via telemetry to derive ping. */
  ts?: number
}

export interface MoveCommand {
  cmd: 'move'
  throttle: number
  steer_deg?: number
}

export interface CalibrateCommand {
  cmd: 'calibrate'
}

export interface SetBrightnessCommand {
  cmd: 'set_brightness'
  level: number
}

export type ClientCommand =
  | HeartbeatCommand
  | MoveCommand
  | CalibrateCommand
  | SetBrightnessCommand

export interface ErrorMessage {
  type: 'error'
  message: string
}
