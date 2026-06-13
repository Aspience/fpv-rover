import { apiClient, whepClient } from '@/api/client'
import type {
  ConfigResponse,
  HealthResponse,
  UpdateApplyResponse,
  UpdateCheckResponse,
} from '@/types/contracts'
import {
  ConfigResponseSchema,
  HealthResponseSchema,
  UpdateApplyResponseSchema,
  UpdateCheckResponseSchema,
} from '@/types/schemas'

export const fetchConfig = async (): Promise<ConfigResponse> => {
  const { data } = await apiClient.get<unknown>('/config')

  const parsed = ConfigResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid config response: ${parsed.error.message}`)
  }

  return parsed.data
}

export const pingHealth = async (): Promise<HealthResponse> => {
  const { data } = await apiClient.get<unknown>('/health')

  const parsed = HealthResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid health response: ${parsed.error.message}`)
  }

  return parsed.data
}

export const checkUpdate = async (): Promise<UpdateCheckResponse> => {
  const { data } = await apiClient.get<unknown>('/update/check')

  const parsed = UpdateCheckResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid update check response: ${parsed.error.message}`)
  }

  return parsed.data
}

export const applyUpdate = async (): Promise<UpdateApplyResponse> => {
  const { data } = await apiClient.post<unknown>('/update/apply')

  const parsed = UpdateApplyResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid update apply response: ${parsed.error.message}`)
  }

  return parsed.data
}

export const postWhepOffer = async (sdp: string): Promise<string> => {
  const { data } = await whepClient.post<string>('/rover/whep', sdp)
  return data
}
