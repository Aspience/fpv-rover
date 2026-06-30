import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useLogStore } from '@/store/logStore'
import { useTelemetryStore } from '@/store/telemetryStore'

/**
 * Logs Bluetooth connect/disconnect transitions. State is driven entirely by
 * telemetry (`telemetryStore.bluetooth`) coming over the main `/ws` socket.
 */
export const useBluetoothStatusLog = () => {
  const { t } = useTranslation()
  const appendLog = useLogStore((state) => state.appendLog)
  const bluetooth = useTelemetryStore((state) => state.bluetooth)
  const prevConnectedRef = useRef<boolean | null>(null)
  const lastNameRef = useRef<string | null>(null)

  useEffect(() => {
    const connected = bluetooth?.connected ?? false
    if (connected && bluetooth?.name) {
      lastNameRef.current = bluetooth.name
    }

    const prev = prevConnectedRef.current
    prevConnectedRef.current = connected

    if (prev === null || prev === connected) return

    const name = lastNameRef.current
    if (connected) {
      appendLog({
        message: name
          ? `${t('bluetoothDeviceConnected')}: ${name}`
          : t('bluetoothDeviceConnected'),
        tone: 'primary',
      })
    } else {
      appendLog({
        message: name
          ? `${t('bluetoothDeviceDisconnected')}: ${name}`
          : t('bluetoothDeviceDisconnected'),
        tone: 'warning',
      })
    }
  }, [appendLog, bluetooth, t])
}
