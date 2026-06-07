import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  applyLocalePreference,
  getLocalePreference,
  type LocalePreference,
} from '@/i18n'

import './Settings.css'

export const Settings = () => {
  const { t } = useTranslation()
  const [preference, setPreference] = useState<LocalePreference>(getLocalePreference)

  const handleChange = (next: LocalePreference) => {
    setPreference(next)
    void applyLocalePreference(next)
  }

  return (
    <section className="settings" aria-label={t('settings')}>
      <h2 className="settings__title">{t('settings')}</h2>
      <div className="settings__field">
        <label className="settings__label" htmlFor="locale-select">
          {t('language')}
        </label>
        <select
          id="locale-select"
          className="settings__select"
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
    </section>
  )
}
