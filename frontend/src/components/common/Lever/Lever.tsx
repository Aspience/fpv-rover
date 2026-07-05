import { clsx } from 'clsx'
import { useCallback, useRef } from 'react'

import { useHapticFeedback } from '@/hooks/useHapticFeedback'

type LeverOrientation = 'vertical' | 'horizontal'

interface LeverProps {
  value: number
  min: number
  max: number
  orientation: LeverOrientation
  onChange: (value: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  className?: string
  ariaLabel: string
}

const TRACK_SIZE = 120
const HANDLE_SIZE = 28

export const Lever = ({
  value,
  min,
  max,
  orientation,
  onChange,
  onDragStart,
  onDragEnd,
  className = '',
  ariaLabel,
}: LeverProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const { onValueChange } = useHapticFeedback()

  const ratio = (value - min) / (max - min)
  const clampedRatio = Math.max(0, Math.min(1, ratio))

  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      let nextRatio: number
      if (orientation === 'vertical') {
        nextRatio = 1 - (clientY - rect.top) / rect.height
      } else {
        nextRatio = (clientX - rect.left) / rect.width
      }
      nextRatio = Math.max(0, Math.min(1, nextRatio))
      const next = Math.round(min + nextRatio * (max - min))
      onValueChange(next, min, max)
      onChange(next)
    },
    [max, min, onChange, onValueChange, orientation],
  )

  const onPointerDown = (event: React.PointerEvent) => {
    draggingRef.current = true
    onDragStart?.()
    event.currentTarget.setPointerCapture(event.pointerId)
    handlePointer(event.clientX, event.clientY)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return
    handlePointer(event.clientX, event.clientY)
  }

  const onPointerUp = (event: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    onDragEnd?.()
    onChange(0)
    onValueChange(0, min, max)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleStyle =
    orientation === 'vertical'
      ? {
          left: '50%',
          top: `${(1 - clampedRatio) * 100}%`,
          transform: 'translate(-50%, -50%)',
        }
      : {
          left: `${clampedRatio * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }

  return (
    <div
      className={clsx(
        'flex touch-none select-none items-center justify-center rounded-lg border border-osd-primary/30 bg-osd-panel p-3 backdrop-blur-sm',
        className,
      )}
    >
      <div
        ref={trackRef}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className={clsx(
          'relative rounded-full bg-osd-muted/30',
          orientation === 'vertical' ? 'h-32 w-3' : 'h-3 w-32',
        )}
        style={
          orientation === 'vertical'
            ? { height: TRACK_SIZE, width: 12 }
            : { width: TRACK_SIZE, height: 12 }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute rounded-full border-2 border-osd-primary bg-osd-panel shadow-md"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            ...handleStyle,
          }}
        />
      </div>
    </div>
  )
}
