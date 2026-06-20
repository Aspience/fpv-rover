import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyLocalePreference,
  getLocalePreference,
  type LocalePreference,
} from '@/i18n'

import { OTAUpdater } from '@/components/common/OTAUpdater'
import { Modal } from '@/components/ui'

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

  return (
    <Modal
      open={open}
      title={t('settings')}
      onClose={onClose}
      closeLabel={t('settingsClose')}
      panelClassName="min-w-48 w-full"
    >
        <div className="flex flex-col gap-1">
          <label className="text-osd-xs text-osd-primary/70" htmlFor="locale-select">
            {t('language')}
          </label>
          <select
            id="locale-select"
            className="w-full rounded border border-osd-primary/25 bg-black/40 px-2 py-1.5 text-osd-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-osd-primary"
            value={preference}
            onChange={(event) =>
              handleChange(event.target.value as LocalePreference)
            }
          >
            <option value="system">{t('languageSystem')}</option>
            <option value="en">{t('languageEn')}</option>
            <option value="ru">{t('languageRu')}</option>
          </select>
        </div>

        <OTAUpdater />
    </Modal>
  )
}
