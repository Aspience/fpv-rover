import { useTranslation } from 'react-i18next'

import { useSystemStore } from '@/store/systemStore'

import './ConnectionAlert.css'

export const ConnectionAlert = () => {
  const { t } = useTranslation()
  const wsConnected = useSystemStore((s) => s.wsConnected)
  const configLoaded = useSystemStore((s) => s.configLoaded)

  if (!configLoaded || wsConnected) return null

  return (
    <div className="connection-alert">
      <div className="connection-alert__banner">
        {t('connectionLost')}
      </div>
    </div>
  )
}
