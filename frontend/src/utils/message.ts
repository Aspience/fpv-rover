import { useTelemetryStore } from '@/store/telemetryStore'
import { ErrorMessageSchema, TelemetryMessageSchema } from '@/types/schemas'

export const handleSocketMessage = (raw: string): void => {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return
  }

  const telemetry = TelemetryMessageSchema.safeParse(json)
  if (telemetry.success) {
    const clientTs = telemetry.data.client_ts
    if (typeof clientTs === 'number') {
      useTelemetryStore.getState().recordPing(clientTs)
    }
    useTelemetryStore.getState().updateFromModules(telemetry.data.modules)
    return
  }

  ErrorMessageSchema.safeParse(json)
}
