import { useTranslation } from 'react-i18next'

export const AppLoader = () => {
  const { t } = useTranslation()

  return (
    <main
      className="fixed inset-0 z-loader flex flex-col items-center justify-center gap-4 bg-black"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-osd-primary/25 border-t-osd-primary"
        aria-hidden="true"
      />
      <p className="m-0 text-osd-sm text-osd-primary">{t('loading')}</p>
    </main>
  )
}
