import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/ui'
import { useSystemStore } from '@/store/systemStore'

import './OtaUpdatingOverlay.css'

export const OtaUpdatingOverlay = () => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)

  return (
    <Modal open={otaStatus === 'updating'}>
      <div className="ota-updating-overlay__content">
        <div className="ota-updating-overlay__spinner" aria-hidden="true" />
        <p className="ota-updating-overlay__text">{t('otaUpdating')}</p>
      </div>
    </Modal>
  )
}
