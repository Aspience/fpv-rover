import type { HTMLAttributes } from 'react'

import './Badge.css'

type BadgeTone = 'primary' | 'warning' | 'danger' | 'muted'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const toneClass: Record<BadgeTone, string> = {
  primary: 'badge--primary',
  warning: 'badge--warning',
  danger: 'badge--danger',
  muted: 'badge--muted',
}

export const Badge = ({
  tone = 'primary',
  className = '',
  ...props
}: BadgeProps) => {
  return (
    <span
      className={`badge ${toneClass[tone]} ${className}`.trim()}
      {...props}
    />
  )
}
