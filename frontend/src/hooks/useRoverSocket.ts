import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import useWebSocket, { ReadyState } from 'react-use-websocket'

import { loadConfig } from '@/api/config'
import { wsUrl } from '@/api/env'
import { useSystemStore } from '@/store/systemStore'
import { useTelemetryStore } from '@/store/telemetryStore'
import { useWsStore } from '@/store/wsStore'
import {
  ClientCommandSchema,
  ErrorMessageSchema,
  TelemetryMessageSchema,
} from '@/types/schemas'

const HEARTBEAT_MS = 500
const MAX_RECONNECT_MS = 10_000

const handleMessage = (raw: string): void => {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return
  }

  const telemetry = TelemetryMessageSchema.safeParse(json)
  if (telemetry.success) {
    useTelemetryStore.getState().updateFromModules(telemetry.data.modules)
    return
  }

  ErrorMessageSchema.safeParse(json)
}

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
    onMessage: (event) => handleMessage(String(event.data)),
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
  const setModules = useSystemStore((state) => state.setModules)
  const setConfigLoaded = useSystemStore((state) => state.setConfigLoaded)

  const { data } = useQuery({
    queryKey: ['rover', 'config'],
    queryFn: loadConfig,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!data) return
    setModules(data.modules)
    setConfigLoaded(true)
  }, [data, setConfigLoaded, setModules])
}
