import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchConfig } from '@/api/config'
import { wsClient } from '@/api/websocket'
import { ConnectionAlert, Dashboard, OSD, OtaUpdatingOverlay, Settings, VideoPlayer } from '@/components/common'
import { useGamepad, useKeyboard } from '@/hooks'

import './App.css'

const App = () => {
  useGamepad()
  useKeyboard()
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  useEffect(() => {
    void fetchConfig().catch(() => undefined)
    wsClient.connect()
    return () => wsClient.disconnect()
  }, [])

  return (
    <main className="app">
      <VideoPlayer />
      <OSD />
      <Settings />
      <Dashboard />
      <ConnectionAlert />
      <OtaUpdatingOverlay />
    </main>
  )
}

export default App
