import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  children: ReactNode
  className?: string
}

export const Modal = ({ open, children, className = '' }: ModalProps) => {
  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm ${className}`.trim()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  )
}
