import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const Slider = ({ label, className = '', ...props }: SliderProps) => {
  return (
    <label className={clsx('flex flex-col gap-1 text-osd-xs text-osd-muted', className)}>
      <span>{label}</span>
      <input type="range" className="h-1 w-full cursor-pointer accent-osd-primary" {...props} />
    </label>
  )
}
