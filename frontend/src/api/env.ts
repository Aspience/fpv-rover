import {
  API_BASE_PATH,
  BLUETOOTH_SCAN_WS_PATH,
  DEFAULT_API_PORT,
  DEFAULT_RPI_HOST,
  DEFAULT_WEBRTC_PORT,
  WHEP_STREAM_PATH,
  WS_PATH,
} from '@/constants'

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const env = {
  rpiHost: import.meta.env.VITE_RPI_HOST ?? DEFAULT_RPI_HOST,
  apiPort: Number(import.meta.env.VITE_API_PORT ?? DEFAULT_API_PORT),
  webrtcPort: Number(import.meta.env.VITE_WEBRTC_PORT ?? DEFAULT_WEBRTC_PORT),
} as const

/** Browser-facing host for WebRTC/WHEP (MediaMTX is not proxied through nginx). */
export const browserHost = (): string => {
  if (import.meta.env.DEV) {
    return env.rpiHost
  }
  if (typeof window !== 'undefined') {
    return window.location.hostname
  }
  return env.rpiHost
}

export const apiBaseUrl = (): string => API_BASE_PATH

export const wsUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${WS_PATH}`
}

export const bluetoothScanWsUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${BLUETOOTH_SCAN_WS_PATH}`
}

export const whepBaseUrl = (): string => `http://${browserHost()}:${env.webrtcPort}`

export const whepUrl = (): string => `${whepBaseUrl()}${WHEP_STREAM_PATH}`

export const assertEnv = (): void => {
  required(import.meta.env.VITE_RPI_HOST, 'VITE_RPI_HOST')
  required(import.meta.env.VITE_API_PORT, 'VITE_API_PORT')
  required(import.meta.env.VITE_WEBRTC_PORT, 'VITE_WEBRTC_PORT')
}
