import type { ClientCommand } from '@/types/contracts'
import { ClientCommandSchema } from '@/types/schemas'
import { useSystemStore } from '@/store/systemStore'
import { wsUrl } from '@/api/env'
import { handleSocketMessage } from '@/utils'

const HEARTBEAT_MS = 500
const MAX_BACKOFF_MS = 10_000

class WebSocketClient {
  private socket: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private backoffMs = 500
  private shouldRun = false

  connect(): void {
    this.shouldRun = true
    this.open()
  }

  disconnect(): void {
    this.shouldRun = false
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    useSystemStore.getState().setWsConnected(false)
  }

  send(command: ClientCommand): void {
    const parsed = ClientCommandSchema.safeParse(command)
    if (!parsed.success || this.socket?.readyState !== WebSocket.OPEN) {
      return
    }
    this.socket.send(JSON.stringify(parsed.data))
  }

  private open(): void {
    if (!this.shouldRun) return

    const socket = new WebSocket(wsUrl())
    this.socket = socket

    socket.onopen = () => {
      this.backoffMs = 500
      useSystemStore.getState().setWsConnected(true)
      this.startHeartbeat()
    }

    socket.onmessage = (event) => {
      handleSocketMessage(String(event.data))
    }

    socket.onclose = () => {
      useSystemStore.getState().setWsConnected(false)
      this.clearHeartbeat()
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      socket.close()
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ cmd: 'heartbeat' })
    }, HEARTBEAT_MS)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
      this.open()
    }, this.backoffMs)
  }
}

export const wsClient = new WebSocketClient()

export const sendMove = (pwmLeft: number, pwmRight: number, steer = 0): void => {
  wsClient.send({
    cmd: 'move',
    pwm_left: pwmLeft,
    pwm_right: pwmRight,
    steer,
  })
}

export const sendBrightness = (level: number): void => {
  wsClient.send({ cmd: 'set_brightness', level })
}
