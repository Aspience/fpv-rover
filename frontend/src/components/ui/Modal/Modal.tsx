import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

interface ModalProps {
  open: boolean
  children: ReactNode
  title?: string
  onClose?: () => void
  closeLabel?: string
  className?: string
  panelClassName?: string
}

export const Modal = ({
  open,
  children,
  title,
  onClose,
  closeLabel = 'Close',
  className = '',
  panelClassName = '',
}: ModalProps) => {
  if (!open) return null

  const hasHeader = title != null || onClose != null

  return (
    <div
      className={`mx-auto w-[468px] max-w-full fixed inset-0 z-modal flex items-center justify-center ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {hasHeader ? (
        <section
          className={`rounded-lg border border-osd-primary/30 bg-osd-panel p-3 px-4 backdrop-blur-sm ${panelClassName}`.trim()}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            {title ? (
              <h2
                id="modal-title"
                className="m-0 text-osd-sm font-semibold tracking-wider text-osd-primary uppercase"
              >
                {title}
              </h2>
            ) : null}
            {onClose ? (
              <Button
                variant="subtle"
                size="icon-sm"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {children}
        </section>
      ) : (
        children
      )}
    </div>
  )
}
