import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyLocalePreference,
  getLocalePreference,
  type LocalePreference,
} from '@/i18n'

import { OTAUpdater } from '@/components/common/OTAUpdater'
import { Modal, Select } from '@/components/ui'
import type { SelectOption } from '@/components/ui'

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export const Settings = ({ open, onClose }: SettingsProps) => {
  const { t } = useTranslation()
  const [preference, setPreference] = useState<LocalePreference>(getLocalePreference)

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

  return (
    <Modal
      open={open}
      title={t('settings')}
      onClose={onClose}
      closeLabel={t('settingsClose')}
      panelClassName="min-w-48 w-full"
    >
        <Select
          id="locale-select"
          label={t('language')}
          options={localeOptions}
          value={preference}
          onChange={(event) =>
            handleChange(event.target.value as LocalePreference)
          }
        />

        <OTAUpdater onInstallStart={onClose} />
    </Modal>
  )
}
