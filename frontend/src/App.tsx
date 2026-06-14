import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useConfigQuery } from '@/api/queries'
import { wsClient } from '@/api/websocket'
import { Dashboard, EventLog, OSD, OtaUpdatingOverlay, Settings, VideoPlayer } from '@/components/common'
import { useConnectionLostLog, useGamepad, useKeyboard } from '@/hooks'

import './App.css'

const App = () => {
  useGamepad()
  useKeyboard()
  useConnectionLostLog()
  useConfigQuery()
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [])

  return (
    <main className="app">
      <VideoPlayer />
      <OSD />
      <EventLog />
      <Settings />
      <Dashboard />
      <OtaUpdatingOverlay />
    </main>
  )
}

export default App
