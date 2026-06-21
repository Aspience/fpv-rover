import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/ui'
import { useSystemStore } from '@/store/systemStore'

export const OtaUpdatingOverlay = () => {
  const { t } = useTranslation()
  const otaStatus = useSystemStore((s) => s.otaStatus)

  return (
    <Modal open={otaStatus === 'updating'}>
      <div className="flex max-w-96 flex-col items-center gap-4 p-6 text-center">
        <div
          className="size-10 animate-spin rounded-full border-[3px] border-osd-primary/25 border-t-osd-primary"
          aria-hidden="true"
        />
        <p className="m-0 text-osd-sm text-osd-primary">{t('otaUpdating')}</p>
      </div>
    </Modal>
  )
}
