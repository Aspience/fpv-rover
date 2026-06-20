import { useEffect, useState } from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useConfigQuery } from '@/api/queries'
import { wsClient } from '@/api/websocket'
import { Dashboard, EventLog, OSD, OtaUpdatingOverlay, Settings, VideoPlayer } from '@/components/common'
import { Button } from '@/components/ui'
import { useConnectionLostLog, useGamepad, useKeyboard, useStartupLog } from '@/hooks'

import './App.css'

const App = () => {
  useGamepad()
  useKeyboard()
  useStartupLog()
  useConnectionLostLog()
  useConfigQuery()
  const { t, i18n } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [])

  return (
    <main className="app">
      <VideoPlayer className="absolute inset-0 z-video" />
      <OSD className="pointer-events-none absolute inset-0 z-osd" />
      <EventLog className="absolute top-3 left-4 z-dashboard" />
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
      <Dashboard className="absolute bottom-4 left-1/2 z-dashboard -translate-x-1/2" />
      <OtaUpdatingOverlay />
    </main>
  )
}

export default App
