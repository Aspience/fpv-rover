import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyLocalePreference,
  getLocalePreference,
  type LocalePreference,
} from '@/i18n'

import {
  useCameraStreamConfigQuery,
  useSetCameraStreamConfigMutation,
} from '@/api/queries'
import { sendCalibrate } from '@/api/websocket'
import { Bluetooth } from '@/components/common/Bluetooth'
import { OTAUpdater } from '@/components/common/OTAUpdater'
import { Button, Modal, Select, Tab, TabList, TabPanel, Tabs } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import {
  DEFAULT_BITRATE_BPS,
  DEFAULT_RESOLUTION,
  STREAM_RECONNECT_DELAY_MS,
} from '@/constants'
import { useSystemStore } from '@/store/systemStore'
import { useTelemetryStore } from '@/store/telemetryStore'
import {
  formatResolution,
  getCameraBitrateOptions,
  getCameraResolutionOptions,
  parseResolution,
} from '@/utils'

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export const Settings = ({ open, onClose }: SettingsProps) => {
  const { t } = useTranslation()
  const [preference, setPreference] = useState<LocalePreference>(getLocalePreference)
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION)
  const [bitrate, setBitrate] = useState(String(DEFAULT_BITRATE_BPS))

  const reconnectVideo = useSystemStore((state) => state.reconnectVideo)
  const bluetoothEnabled = useSystemStore((state) => state.modules.bluetooth)
  const motionEnabled = useSystemStore((state) => state.modules.motion)
  const calibrating = useTelemetryStore((state) => state.motion?.calibrating ?? false)
  const { mutate: applyStreamConfig } = useSetCameraStreamConfigMutation()
  const { data: streamConfig } = useCameraStreamConfigQuery(open)

  useEffect(() => {
    if (!streamConfig) return
    setResolution(formatResolution(streamConfig.width, streamConfig.height))
    setBitrate(String(streamConfig.bitrate))
  }, [streamConfig])

  const handleChange = (next: LocalePreference) => {
    setPreference(next)
    void applyLocalePreference(next)
  }

  const localeOptions = useMemo<SelectOption<LocalePreference>[]>(
    () => [
      { value: 'system', label: t('languageSystem') },
      { value: 'en', label: t('languageEn') },
      { value: 'ru', label: t('languageRu') },
    ],
    [t],
  )

  const resolutionOptions = useMemo(() => getCameraResolutionOptions(), [])
  const bitrateOptions = useMemo(() => getCameraBitrateOptions(), [])

  const applyStream = (nextResolution: string, nextBitrate: string) => {
    const { width, height } = parseResolution(nextResolution)
    applyStreamConfig(
      { width, height, bitrate: Number(nextBitrate) },
      {
        onSuccess: () => {
          window.setTimeout(reconnectVideo, STREAM_RECONNECT_DELAY_MS)
        },
      },
    )
  }

  const handleResolutionChange = (next: string) => {
    setResolution(next)
    applyStream(next, bitrate)
  }

  const handleBitrateChange = (next: string) => {
    setBitrate(next)
    applyStream(resolution, next)
  }

  return (
    <Modal
      open={open}
      title={t('settings')}
      onClose={onClose}
      closeLabel={t('settingsClose')}
      panelClassName="min-w-48 w-full"
    >
      <Tabs defaultValue="general">
        <TabList aria-label={t('settings')}>
          <Tab value="general">{t('settingsTabGeneral')}</Tab>
          {bluetoothEnabled ? (
            <Tab value="bluetooth">{t('settingsTabBluetooth')}</Tab>
          ) : null}
        </TabList>

        <TabPanel value="general">
          <Select
            id="locale-select"
            label={t('language')}
            options={localeOptions}
            value={preference}
            onChange={(event) =>
              handleChange(event.target.value as LocalePreference)
            }
          />

          <div className="mt-3 flex gap-3">
            <div className="flex-1">
              <Select
                id="resolution-select"
                label={t('cameraResolution')}
                options={resolutionOptions}
                value={resolution}
                onChange={(event) => handleResolutionChange(event.target.value)}
              />
            </div>
            <div className="flex-1">
              <Select
                id="bitrate-select"
                label={t('cameraBitrate')}
                options={bitrateOptions}
                value={bitrate}
                onChange={(event) => handleBitrateChange(event.target.value)}
              />
            </div>
          </div>

          <OTAUpdater onInstallStart={onClose} />

          {motionEnabled ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={calibrating}
                onClick={() => sendCalibrate()}
              >
                {calibrating ? t('calibrating') : t('calibrateSteering')}
              </Button>
            </div>
          ) : null}
        </TabPanel>

        {bluetoothEnabled ? (
          <TabPanel value="bluetooth">
            <Bluetooth />
          </TabPanel>
        ) : null}
      </Tabs>
    </Modal>
  )
}
