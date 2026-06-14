import { X } from 'lucide-react'
import type { ReactNode } from 'react'

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
      className={`fixed inset-0 z-modal flex items-center justify-center bg-black/60 backdrop-blur-sm ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {hasHeader ? (
        <section
          className={`rounded-lg border border-osd-primary/30 bg-osd-panel p-3 px-4 backdrop-blur-sm ${panelClassName}`.trim()}
        >
          <div className="mb-2 flex items-center gap-2">
            {title ? (
              <h2
                id="modal-title"
                className="m-0 text-osd-sm font-semibold tracking-wider text-osd-primary uppercase"
              >
                {title}
              </h2>
            ) : null}
            {onClose ? (
              <button
                type="button"
                className="rounded p-0.5 text-osd-muted transition-colors hover:text-osd-primary"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
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
