import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

type BadgeTone = 'primary' | 'warning' | 'danger' | 'muted'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  primary: 'border-osd-primary/50 text-osd-primary',
  warning: 'border-osd-warning/50 text-osd-warning',
  danger: 'border-osd-danger/50 text-osd-danger',
  muted: 'border-white/20 text-osd-muted',
}

export const Badge = ({
  tone = 'primary',
  className = '',
  ...props
}: BadgeProps) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded border border-transparent bg-osd-panel px-2 py-0.5 text-osd-xs',
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
}
