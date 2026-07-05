/**
 * Centralized application constants for the FPV rover frontend.
 *
 * Grouped by domain. Values that were previously scattered as module-local
 * magic numbers/strings live here so they can be tuned in one place.
 */

// ── Network / API ──────────────────────────────────────────────────────────
export const DEFAULT_RPI_HOST = 'localhost'
export const DEFAULT_API_PORT = 8000
export const DEFAULT_WEBRTC_PORT = 8889

export const API_BASE_PATH = '/api'
export const WS_PATH = '/ws'
export const BLUETOOTH_SCAN_WS_PATH = '/api/bluetooth/scan-ws'
export const WHEP_STREAM_PATH = '/rover/whep'

// ── WebSocket / reconnection ───────────────────────────────────────────────
export const HEARTBEAT_MS = 500
export const RECONNECT_BASE_MS = 500
export const MAX_RECONNECT_MS = 10_000

// ── Link / ping thresholds (ms) ────────────────────────────────────────────
/** Upper bound for a "good" round-trip time to the backend. */
export const PING_GOOD_MS = 80
/** Upper bound for an acceptable round-trip time; above this is considered bad. */
export const PING_WARN_MS = 200

// ── Control input ──────────────────────────────────────────────────────────
/** How often control commands are pushed to the rover (Hz). */
export const CONTROL_SEND_HZ = 20
/** Gamepad analog stick deadzone (normalized 0..1). */
export const GAMEPAD_DEADZONE = 0.1
/** PWM applied when driving via keyboard. */
export const KEYBOARD_PWM = 80
/** PWM reduction on the inner track when turning via keyboard. */
export const KEYBOARD_TURN_DELTA = 40
/** Upper bound of the PWM / brightness scale. */
export const PWM_MAX = 100
export const BRIGHTNESS_MIN = 0
export const BRIGHTNESS_MAX = 100

// ── Battery thresholds (volts) ─────────────────────────────────────────────
export const BATTERY_OK_VOLTAGE = 7.2
export const BATTERY_WARNING_VOLTAGE = 6.5

// ── Polling / queries ──────────────────────────────────────────────────────
export const HEALTH_POLL_MS = 3000
export const QUERY_RETRY_COUNT = 1
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

// ── OTA update flow ────────────────────────────────────────────────────────
export const OTA_STORAGE_KEY = 'fpv-rover.ota-updating'
export const OTA_POLL_INTERVAL_MS = 5000
export const OTA_MAX_DURATION_MS = 15 * 60 * 1000
/** Delay before reconnecting the video stream after a config change. */
export const STREAM_RECONNECT_DELAY_MS = 1200

// ── Persistence keys ───────────────────────────────────────────────────────
export const LOCALE_STORAGE_KEY = 'fpv-rover:locale'

// ── Event log entry ids ────────────────────────────────────────────────────
export const LOG_IDS = {
  startup: 'startup',
  connectionLost: 'connection-lost',
  updateAvailable: 'update-available',
  otaStart: 'ota-update-start',
  otaProgress: 'ota-update-progress',
} as const

// ── Camera stream presets ──────────────────────────────────────────────────
export interface ResolutionPreset {
  value: string
  label: string
  width: number
  height: number
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { value: '426x240', label: '240p', width: 426, height: 240 },
  { value: '640x360', label: '360p', width: 640, height: 360 },
  { value: '854x480', label: '480p', width: 854, height: 480 },
  { value: '1280x720', label: '720p', width: 1280, height: 720 },
  { value: '1920x1080', label: '1080p', width: 1920, height: 1080 },
]

export const BITRATE_MIN_KBPS = 500
export const BITRATE_MAX_KBPS = 5000
export const BITRATE_STEP_KBPS = 250

export const DEFAULT_RESOLUTION = '1280x720'
export const DEFAULT_BITRATE_BPS = 2000 * 1000
