import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

export const LOCALE_STORAGE_KEY = 'fpv-rover:locale'

export type LocalePreference = 'system' | 'en' | 'ru'
export type Locale = 'en' | 'ru'

const isLocalePreference = (value: string | null): value is LocalePreference =>
  value === 'system' || value === 'en' || value === 'ru'

export const getLocalePreference = (): LocalePreference => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocalePreference(stored)) return stored
  } catch {
    // localStorage unavailable
  }
  return 'system'
}

export const setLocalePreference = (preference: LocalePreference): void => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, preference)
  } catch {
    // ignore persistence errors
  }
}

const navigatorDetector = new LanguageDetector()
navigatorDetector.init({
  order: ['navigator'],
  convertDetectedLanguage: (lng) => (lng.startsWith('ru') ? 'ru' : 'en'),
})

export const detectSystemLocale = (): Locale => {
  const detected = navigatorDetector.detect()
  const code = Array.isArray(detected) ? detected[0] : detected
  return code === 'ru' ? 'ru' : 'en'
}

export const resolveLanguage = (preference: LocalePreference): Locale => {
  if (preference === 'en' || preference === 'ru') return preference
  return detectSystemLocale()
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: resolveLanguage(getLocalePreference()),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: [],
      caches: [],
    },
    react: {
      useSuspense: false,
    },
  })

export const applyLocalePreference = async (
  preference: LocalePreference,
): Promise<void> => {
  setLocalePreference(preference)
  await i18n.changeLanguage(resolveLanguage(preference))
}

export default i18n
