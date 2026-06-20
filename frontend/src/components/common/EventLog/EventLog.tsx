import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useLogStore, type LogEntry, type LogTone } from '@/store/logStore'
import { formatTimestamp } from '@/utils'

const toneClass: Record<LogTone, string> = {
  default: 'text-osd-muted',
  primary: 'text-osd-primary',
  warning: 'text-osd-warning',
  danger: 'text-osd-danger',
}

interface EventLogProps {
  className?: string
}

const LogLine = ({ entry, locale }: { entry: LogEntry; locale: string }) => (
  <li className={`leading-snug ${toneClass[entry.tone]}`}>
    <span className="text-osd-muted/70">{formatTimestamp(entry.timestamp, locale)}</span>{' '}
    {entry.message}
  </li>
)

export const EventLog = ({ className = '' }: EventLogProps) => {
  const entries = useLogStore((state) => state.entries)
  const { i18n } = useTranslation()
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [entries])

  return (
    <aside
      className={`absolute top-4 left-4 z-dashboard w-[200px] h-[150px] overflow-hidden rounded-lg border border-osd-primary/30 bg-osd-panel backdrop-blur-sm ${className}`.trim()}
      aria-live="polite"
      aria-label="Event log"
    >
      <ul
        ref={listRef}
        className="m-0 h-full list-none overflow-y-auto p-2 text-osd-xs"
      >
        {entries.length === 0 ? (
          <li className="text-osd-muted/50">&nbsp;</li>
        ) : (
          entries.map((entry) => (
            <LogLine key={entry.id} entry={entry} locale={i18n.language} />
          ))
        )}
      </ul>
    </aside>
  )
}
