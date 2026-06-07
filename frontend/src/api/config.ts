import { apiClient } from '@/api/client'
import type { ConfigResponse } from '@/types/contracts'
import { ConfigResponseSchema } from '@/types/schemas'

export const loadConfig = async (): Promise<ConfigResponse> => {
  const { data } = await apiClient.get<unknown>('/config')

  const parsed = ConfigResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid config response: ${parsed.error.message}`)
  }

  return parsed.data
}
