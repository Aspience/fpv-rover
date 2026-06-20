import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

import './Slider.css'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const Slider = ({ label, className = '', ...props }: SliderProps) => {
  return (
    <label className={clsx('slider', className)}>
      <span>{label}</span>
      <input type="range" className="slider__input" {...props} />
    </label>
  )
}
