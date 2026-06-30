import { useEffect, useState } from 'react'

import { bluetoothScanWsUrl } from '@/api/env'

export interface ScannedDevice {
  mac: string
  name: string
}

interface BluetoothScanResult {
  devices: ScannedDevice[]
  scanning: boolean
}

/**
 * Opens the scan WebSocket on mount and closes it on unmount. The backend stops
 * the bluetoothctl scan in its `finally` block once this socket closes, so the
 * scan runs strictly while the consuming component is mounted.
 */
export const useBluetoothScan = (): BluetoothScanResult => {
  const [devices, setDevices] = useState<ScannedDevice[]>([])
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    const socket = new WebSocket(bluetoothScanWsUrl())

    socket.onopen = () => setScanning(true)

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as Partial<ScannedDevice>
        if (!data.mac) return
        const device: ScannedDevice = {
          mac: data.mac,
          name: data.name ?? data.mac,
        }
        setDevices((prev) =>
          prev.some((entry) => entry.mac === device.mac)
            ? prev
            : [...prev, device],
        )
      } catch {
        // Ignore malformed scan payloads.
      }
    }

    socket.onclose = () => setScanning(false)
    socket.onerror = () => socket.close()

    return () => {
      socket.close()
    }
  }, [])

  return { devices, scanning }
}
