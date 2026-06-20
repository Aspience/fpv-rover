import type { ButtonHTMLAttributes } from 'react'

import './Button.css'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'subtle'
type ButtonSize = 'md' | 'icon' | 'icon-sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'button--primary',
  ghost: 'button--ghost',
  danger: 'button--danger',
  subtle: 'button--subtle',
}

const sizeClass: Record<ButtonSize, string> = {
  md: '',
  icon: 'button--size-icon',
  'icon-sm': 'button--size-icon-sm',
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) => {
  const classes = ['button', variantClass[variant], sizeClass[size], className]
    .filter(Boolean)
    .join(' ')

  return <button type="button" className={classes} {...props} />
}
