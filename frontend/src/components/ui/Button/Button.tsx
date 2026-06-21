import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'md' | 'icon' | 'icon-sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border border-osd-primary bg-osd-primary text-black hover:brightness-110',
  ghost: 'border border-osd-primary/40 bg-osd-panel text-osd-primary hover:border-osd-primary',
  danger: 'border border-osd-danger bg-osd-danger/20 text-osd-danger hover:bg-osd-danger/30',
  subtle: 'border border-transparent bg-transparent text-osd-muted hover:text-osd-primary',
}

const sizeClass: Record<ButtonSize, string> = {
  md: 'rounded px-4 py-2',
  icon: 'rounded-lg p-2',
  'icon-sm': 'rounded p-0.5',
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) => {
  const classes = clsx(
    'inline-flex cursor-pointer items-center justify-center gap-2 text-osd-sm font-medium transition-[filter,background-color,border-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-60',
    variantClass[variant],
    sizeClass[size],
    className,
  )

  return <button type="button" className={classes} {...props} />
}
