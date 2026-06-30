import {

  QueryClient,

  useMutation,

  useQuery,

} from '@tanstack/react-query'

import { useEffect } from 'react'



import {
  applyUpdate,
  checkUpdate,
  fetchCameraStreamConfig,
  fetchConfig,
  fetchPairedDevices,
  pairDevice,
  pingHealth,
  removeDevice,
  setCameraStreamConfig,
} from '@/api/http'

import { useSystemStore } from '@/store/systemStore'
import { HEALTH_POLL_MS, QUERY_RETRY_COUNT } from '@/constants'



export const queryClient = new QueryClient({

  defaultOptions: {

    queries: {

      retry: QUERY_RETRY_COUNT,

    },

  },

})



export const roverKeys = {

  all: ['rover'] as const,

  config: () => [...roverKeys.all, 'config'] as const,

  health: () => [...roverKeys.all, 'health'] as const,

  cameraStreamConfig: () => [...roverKeys.all, 'camera-stream-config'] as const,

  bluetoothDevices: () => [...roverKeys.all, 'bluetooth-devices'] as const,

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



export const useAppBootstrapQuery = () =>
  useQuery({
    queryKey: roverKeys.health(),
    queryFn: pingHealth,
    retry: false,
    refetchInterval: (query) =>
      query.state.status === 'success' ? false : HEALTH_POLL_MS,
  })

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



export const useCameraStreamConfigQuery = (enabled: boolean) =>
  useQuery({
    queryKey: roverKeys.cameraStreamConfig(),
    queryFn: fetchCameraStreamConfig,
    enabled,
    staleTime: Infinity,
  })

export const useSetCameraStreamConfigMutation = () =>

  useMutation({

    mutationFn: setCameraStreamConfig,

    onSuccess: (_data, variables) => {

      queryClient.setQueryData(roverKeys.cameraStreamConfig(), variables)

    },

  })

export const useBluetoothDevicesQuery = (enabled: boolean) =>
  useQuery({
    queryKey: roverKeys.bluetoothDevices(),
    queryFn: fetchPairedDevices,
    enabled,
  })

export const usePairDeviceMutation = () =>
  useMutation({
    mutationFn: pairDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roverKeys.bluetoothDevices(),
      })
    },
  })

export const useRemoveDeviceMutation = () =>
  useMutation({
    mutationFn: removeDevice,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roverKeys.bluetoothDevices(),
      })
    },
  })
