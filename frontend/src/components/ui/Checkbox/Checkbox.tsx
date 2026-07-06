import { clsx } from 'clsx'
import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const Checkbox = ({ label, id, className = '', ...props }: CheckboxProps) => {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <label
      htmlFor={inputId}
      className={clsx(
        'flex cursor-pointer items-center gap-2 text-osd-xs text-osd-muted',
        props.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="size-4 shrink-0 accent-osd-primary disabled:cursor-not-allowed"
        {...props}
      />
      <span>{label}</span>
    </label>
  )
}
