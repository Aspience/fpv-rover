import type { ImuData } from '@/types/contracts'

export const attitudeFromImu = (imu: ImuData): { pitch: number; roll: number } => {
  const pitch = (Math.atan2(imu.ay_g, imu.az_g) * 180) / Math.PI
  const roll = (Math.atan2(-imu.ax_g, imu.az_g) * 180) / Math.PI
  return { pitch, roll }
}

export const batteryTone = (voltage: number): 'primary' | 'warning' | 'danger' => {
  if (voltage >= 7.2) return 'primary'
  if (voltage >= 6.5) return 'warning'
  return 'danger'
}
