import { apiClient } from '@/api/client'
import type { HealthResponse } from '@/types/contracts'
import { HealthResponseSchema } from '@/types/schemas'

export const pingHealth = async (): Promise<HealthResponse> => {
  const { data } = await apiClient.get<unknown>('/health')

  const parsed = HealthResponseSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid health response: ${parsed.error.message}`)
  }

  return parsed.data
}
