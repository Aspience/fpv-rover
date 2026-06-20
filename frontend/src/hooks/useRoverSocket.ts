import { useEffect } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'

import { wsUrl } from '@/api/env'
import { useConfigQuery } from '@/api/queries'
import { useSystemStore } from '@/store/systemStore'
import { useWsStore } from '@/store/wsStore'
import { ClientCommandSchema } from '@/types/schemas'
import { handleSocketMessage } from '@/utils'

const HEARTBEAT_MS = 500
const MAX_RECONNECT_MS = 10_000

export const useRoverWebSocket = (): void => {
  const setWsConnected = useSystemStore((state) => state.setWsConnected)
  const setSend = useWsStore((state) => state.setSend)

  const { sendJsonMessage, readyState } = useWebSocket(wsUrl(), {
    shouldReconnect: () => true,
    reconnectAttempts: Infinity,
    reconnectInterval: (attempt) =>
      Math.min(500 * 2 ** attempt, MAX_RECONNECT_MS),
    heartbeat: {
      message: JSON.stringify({ cmd: 'heartbeat' }),
      interval: HEARTBEAT_MS,
    },
    onMessage: (event) => handleSocketMessage(String(event.data)),
  })

  useEffect(() => {
    setWsConnected(readyState === ReadyState.OPEN)
  }, [readyState, setWsConnected])

  useEffect(() => {
    setSend((command) => {
      const parsed = ClientCommandSchema.safeParse(command)
      if (parsed.success) {
        sendJsonMessage(parsed.data)
      }
    })

    return () => setSend(null)
  }, [sendJsonMessage, setSend])
}

export const useConfig = (): void => {
  useConfigQuery()
}
