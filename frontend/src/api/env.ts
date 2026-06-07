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

export const apiBaseUrl = (): string => {
  if (import.meta.env.DEV) {
    return '/api'
  }
  return `http://${env.rpiHost}:${env.apiPort}`
}

export const wsUrl = (): string => {
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  return `ws://${env.rpiHost}:${env.apiPort}/ws`
}

export const whepUrl = (): string => {
  return `http://${env.rpiHost}:${env.webrtcPort}/rover/whep`
}

export const assertEnv = (): void => {
  required(import.meta.env.VITE_RPI_HOST, 'VITE_RPI_HOST')
  required(import.meta.env.VITE_API_PORT, 'VITE_API_PORT')
  required(import.meta.env.VITE_WEBRTC_PORT, 'VITE_WEBRTC_PORT')
}
