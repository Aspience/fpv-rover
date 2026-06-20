import { create } from 'zustand'

import { createLogId } from '@/utils/id'

export type LogTone = 'default' | 'primary' | 'warning' | 'danger'

export interface LogEntry {
  id: string
  message: string
  tone: LogTone
  timestamp: number
}

interface AppendLogInput {
  id?: string
  message: string
  tone?: LogTone
  skipIfExists?: boolean
}

interface LogState {
  entries: LogEntry[]
  appendLog: (entry: AppendLogInput) => void
  removeLog: (id: string) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  appendLog: ({ id, message, tone = 'default', skipIfExists = false }) =>
    set((state) => {
      const entryId = id ?? createLogId()
      if (id && state.entries.some((entry) => entry.id === id)) {
        if (skipIfExists) {
          return state
        }
        return {
          entries: state.entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, message, tone, timestamp: Date.now() }
              : entry,
          ),
        }
      }
      return {
        entries: [
          ...state.entries,
          { id: entryId, message, tone, timestamp: Date.now() },
        ],
      }
    }),
  removeLog: (id) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    })),
  clearLogs: () => set({ entries: [] }),
}))
