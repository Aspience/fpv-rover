import { useEffect, useState } from 'react'
import { ScrollText, Settings as SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppBootstrapQuery, useConfigQuery } from '@/api/queries'
import { wsClient } from '@/api/websocket'
import { AppLoader, EventLog, Light, OSD, OtaUpdatingOverlay, Settings, VideoPlayer } from '@/components/common'
import { Button } from '@/components/ui'
import { useConnectionLostLog, useGamepad, useKeyboard, useOtaUpdater, useStartupLog, useUpdateCheckLog } from '@/hooks'
import { useLogStore } from '@/store/logStore'
import { useSystemStore } from '@/store/systemStore'

const App = () => {
  const { isSuccess: appReady } = useAppBootstrapQuery()
  useGamepad()
  useKeyboard()
  useStartupLog()
  useConnectionLostLog()
  useUpdateCheckLog()
  useOtaUpdater()
  useConfigQuery()
  const { t, i18n } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [eventLogOpen, setEventLogOpen] = useState(false)
  const lightEnabled = useSystemStore((s) => s.modules.light)
  const hasUnread = useLogStore((s) => s.entries.some((e) => e.timestamp > s.lastReadAt))

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    if (!appReady) return
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [appReady])

  if (!appReady) {
    return <AppLoader />
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <VideoPlayer className="absolute inset-0 z-video" />
      <OSD className="pointer-events-none absolute inset-0 z-osd" />
      <Button
        variant="ghost"
        size="icon"
        badge={hasUnread && !eventLogOpen}
        className="absolute top-3 left-3 z-dashboard backdrop-blur-sm"
        onClick={() => {
          setEventLogOpen(!eventLogOpen);
        }}
        aria-label={eventLogOpen ? t('eventLogClose') : t('eventLogOpen')}
      >
        <ScrollText className="size-5" aria-hidden="true" />
      </Button>
      {eventLogOpen && <EventLog className="absolute top-14 left-3 z-event-log" />}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 z-dashboard backdrop-blur-sm"
        onClick={() => setSettingsOpen((prev) => !prev)}
        aria-label={settingsOpen ? t('settingsClose') : t('settingsOpen')}
      >
        <SettingsIcon className="size-5" aria-hidden="true" />
      </Button>
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {lightEnabled && (
        <Light className="absolute bottom-4 left-1/2 z-dashboard -translate-x-1/2" />
      )}
      <OtaUpdatingOverlay />
    </main>
  )
}

export default App
