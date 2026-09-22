import { useEffect, useRef, type ReactNode } from 'react'
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

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="aui-dialog"
      style={{ width }}
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
        <div className="aui-dialog__surface">
          <header className="aui-dialog__head">
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </header>
          {children && <div className="aui-dialog__body">{children}</div>}
          {footer && <footer className="aui-dialog__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

export default Dialog
