import type { ClientCommand } from '@/types/contracts'
import { sendCommand } from '@/store/wsStore'

export const sendMove = (pwmLeft: number, pwmRight: number, steer = 0): void => {
  sendCommand({
    cmd: 'move',
    pwm_left: pwmLeft,
    pwm_right: pwmRight,
    steer,
  })
}

export const sendBrightness = (level: number): void => {
  sendCommand({ cmd: 'set_brightness', level })
}

export const sendRecord = (state: 'start' | 'stop'): void => {
  sendCommand({ cmd: 'record', state })
}

export type { ClientCommand }
