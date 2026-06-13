import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { applyUpdate, checkUpdate, fetchConfig, pingHealth } from '@/api/http'
import { useSystemStore } from '@/store/systemStore'

const OTA_POLL_MS = 3000
const OTA_POLL_TIMEOUT_MS = 5 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
})

export const roverKeys = {
  all: ['rover'] as const,
  config: () => [...roverKeys.all, 'config'] as const,
  health: () => [...roverKeys.all, 'health'] as const,
  healthRecovery: (sessionId: number) =>
    [...roverKeys.all, 'health', 'recovery', sessionId] as const,
}

export const useConfigQuery = (): void => {
  const setModules = useSystemStore((state) => state.setModules)
  const setConfigLoaded = useSystemStore((state) => state.setConfigLoaded)

  const { data } = useQuery({
    queryKey: roverKeys.config(),
    queryFn: fetchConfig,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!data) return
    setModules(data.modules)
    setConfigLoaded(true)
  }, [data, setConfigLoaded, setModules])
}

export const useHealthQuery = () =>
  useQuery({
    queryKey: roverKeys.health(),
    queryFn: pingHealth,
  })

export const useCheckUpdateMutation = () =>
  useMutation({
    mutationFn: checkUpdate,
  })

export const useApplyUpdateMutation = () =>
  useMutation({
    mutationFn: applyUpdate,
  })

export const useOtaRecovery = (
  enabled: boolean,
  sessionId: number,
  callbacks: {
    onSuccess: () => void
    onError: (message: string) => void
  },
): void => {
  const queryClientInstance = useQueryClient()
  const startedAtRef = useRef(0)
  const firedRef = useRef(false)
  const callbacksRef = useRef(callbacks)

  useEffect(() => {
    callbacksRef.current = callbacks
  })

  useEffect(() => {
    if (!enabled) return

    startedAtRef.current = Date.now()
    firedRef.current = false

    const timer = window.setInterval(() => {
      if (firedRef.current) return
      if (Date.now() - startedAtRef.current > OTA_POLL_TIMEOUT_MS) {
        firedRef.current = true
        callbacksRef.current.onError('Update timed out waiting for rover to come back online')
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [enabled, sessionId])

  const query = useQuery({
    queryKey: roverKeys.healthRecovery(sessionId),
    queryFn: pingHealth,
    enabled,
    refetchInterval: enabled ? OTA_POLL_MS : false,
    retry: false,
    staleTime: 0,
  })

  useEffect(() => {
    if (!enabled || firedRef.current || !query.isSuccess) return
    if (query.fetchStatus === 'fetching') return

    firedRef.current = true
    void queryClientInstance.invalidateQueries({ queryKey: roverKeys.config() })
    void queryClientInstance.invalidateQueries({ queryKey: roverKeys.health() })
    callbacksRef.current.onSuccess()
  }, [enabled, sessionId, query.isSuccess, query.fetchStatus, queryClientInstance])
}
