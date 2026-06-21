import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

export interface SelectOption<Value extends string = string> {
  value: Value
  label: string
}

interface SelectProps<Value extends string = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value'> {
  options: SelectOption<Value>[]
  label?: string
  value?: Value
}

export const Select = <Value extends string = string>({
  options,
  label,
  id,
  className = '',
  ...props
}: SelectProps<Value>) => {
  const generatedId = useId()
  const selectId = id ?? generatedId

  const control = (
    <div className="relative">
      <select
        id={selectId}
        className={clsx(
          'w-full appearance-none rounded border border-osd-primary/25 bg-black/40 px-2 py-1.5 pr-8 text-osd-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-osd-primary disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-osd-primary/60"
        aria-hidden="true"
      />
    </div>
  )

  if (label == null) return control

  return (
    <div className="flex flex-col gap-1">
      <label className="text-osd-xs text-osd-primary/70" htmlFor={selectId}>
        {label}
      </label>
      {control}
    </div>
  )
}
