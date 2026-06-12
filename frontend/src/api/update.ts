import { apiClient } from '@/api/client'
import type { UpdateApplyResponse, UpdateCheckResponse } from '@/types/contracts'
import {
  UpdateApplyResponseSchema,
  UpdateCheckResponseSchema,
} from '@/types/schemas'

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
