import { clsx } from 'clsx'
import { Loader2, Plus, RadioTower, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  useBluetoothDevicesQuery,
  usePairDeviceMutation,
  useRemoveDeviceMutation,
} from '@/api/queries'
import { Button } from '@/components/ui'
import { useBluetoothScan } from '@/hooks'

interface DeviceRowProps {
  name: string
  mac: string
  connected?: boolean
  children: React.ReactNode
}

const DeviceRow = ({ name, mac, connected, children }: DeviceRowProps) => (
  <li className="flex items-center justify-between gap-2 rounded border border-osd-primary/15 bg-black/30 px-2 py-1.5">
    <div className="min-w-0">
      <p className="truncate text-osd-sm text-white">{name}</p>
      <p className="truncate text-osd-xs text-osd-muted">
        {mac}
        {connected ? (
          <span className="ml-2 text-osd-primary">●</span>
        ) : null}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-1">{children}</div>
  </li>
)

export const Bluetooth = () => {
  const { t } = useTranslation()
  const { data: paired = [], isLoading } = useBluetoothDevicesQuery(true)
  const { devices: scanned, scanning } = useBluetoothScan()
  const pair = usePairDeviceMutation()
  const remove = useRemoveDeviceMutation()

  const pairedMacs = new Set(paired.map((device) => device.mac))
  const discovered = scanned.filter((device) => !pairedMacs.has(device.mac))

  const isPairing = (mac: string) => pair.isPending && pair.variables === mac
  const isRemoving = (mac: string) => remove.isPending && remove.variables === mac

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-2 text-osd-xs tracking-wider text-osd-primary/70 uppercase">
          {t('bluetoothPaired')}
        </h3>
        {paired.length === 0 ? (
          <p className="text-osd-sm text-osd-muted">
            {isLoading ? t('loading') : t('bluetoothNoDevices')}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {paired.map((device) => (
              <DeviceRow
                key={device.mac}
                name={device.name}
                mac={device.mac}
                connected={device.connected}
              >
                <Button
                  variant="danger"
                  size="icon-sm"
                  onClick={() => remove.mutate(device.mac)}
                  disabled={isRemoving(device.mac)}
                  aria-label={t('bluetoothRemove')}
                >
                  {isRemoving(device.mac) ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </DeviceRow>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-osd-xs tracking-wider text-osd-primary/70 uppercase">
          {t('bluetoothScan')}
          <RadioTower
            className={clsx('size-3.5', scanning && 'animate-pulse text-osd-primary')}
            aria-hidden="true"
          />
        </h3>
        {discovered.length === 0 ? (
          <p className="text-osd-sm text-osd-muted">{t('bluetoothScanning')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {discovered.map((device) => (
              <DeviceRow key={device.mac} name={device.name} mac={device.mac}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => pair.mutate(device.mac)}
                  disabled={isPairing(device.mac)}
                  aria-label={t('bluetoothPair')}
                >
                  {isPairing(device.mac) ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </DeviceRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
