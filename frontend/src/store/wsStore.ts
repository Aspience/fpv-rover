import { create } from 'zustand'

import type { ClientCommand } from '@/types/contracts'

type SendCommand = (command: ClientCommand) => void

interface WsStore {
  send: SendCommand | null
  setSend: (send: SendCommand | null) => void
}

export const useWsStore = create<WsStore>((set) => ({
  send: null,
  setSend: (send) => set({ send }),
}))

export const sendCommand = (command: ClientCommand): void => {
  useWsStore.getState().send?.(command)
}
