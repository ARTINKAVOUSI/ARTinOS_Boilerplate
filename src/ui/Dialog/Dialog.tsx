import { useEffect, useId, useRef, type ReactNode } from 'react'
import './Dialog.css'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  /** Buttons, right-aligned. */
  footer?: ReactNode
  width?: number
  children?: ReactNode
}

/**
 * Dialog — a modal built on the native <dialog> element, so focus trapping,
 * Escape and the inert background come from the browser. Clicking the
 * backdrop closes it.
 */
export function Dialog({ open, onClose, title, description, footer, width = 380, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="ar-dialog"
      style={{ width }}
      // Named and described by its own title and description, while they are rendered.
      aria-labelledby={open ? titleId : undefined}
      aria-describedby={open && description ? descriptionId : undefined}
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        // A click whose target is the <dialog> itself landed on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <div className="ar-dialog__surface">
          <header className="ar-dialog__head">
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </header>
          {children && <div className="ar-dialog__body">{children}</div>}
          {footer && <footer className="ar-dialog__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export default Dialog
