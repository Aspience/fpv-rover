import type { ButtonHTMLAttributes } from 'react'

import './Button.css'

type ButtonVariant = 'primary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'button--primary',
  ghost: 'button--ghost',
  danger: 'button--danger',
}

export const Button = ({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) => {
  return (
    <button
      type="button"
      className={`button ${variantClass[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
