const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export const env = {
  rpiHost: import.meta.env.VITE_RPI_HOST ?? 'localhost',
  apiPort: Number(import.meta.env.VITE_API_PORT ?? 8000),
  webrtcPort: Number(import.meta.env.VITE_WEBRTC_PORT ?? 8889),
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

export const apiBaseUrl = (): string => '/api'

export const wsUrl = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

export const whepBaseUrl = (): string => `http://${browserHost()}:${env.webrtcPort}`

export const whepUrl = (): string => `${whepBaseUrl()}/rover/whep`

export const assertEnv = (): void => {
  required(import.meta.env.VITE_RPI_HOST, 'VITE_RPI_HOST')
  required(import.meta.env.VITE_API_PORT, 'VITE_API_PORT')
  required(import.meta.env.VITE_WEBRTC_PORT, 'VITE_WEBRTC_PORT')
}
