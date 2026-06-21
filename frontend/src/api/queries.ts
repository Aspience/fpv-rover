import {

  QueryClient,

  useMutation,

  useQuery,

} from '@tanstack/react-query'

import { useEffect } from 'react'



import { applyUpdate, checkUpdate, fetchConfig, pingHealth } from '@/api/http'

import { useSystemStore } from '@/store/systemStore'



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



const HEALTH_POLL_MS = 3000

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
