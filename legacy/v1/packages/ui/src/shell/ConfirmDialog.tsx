import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss, workspacePortalTarget } from '../headless'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm action in the fault hue — for destructive choices. */
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve(value: boolean): void
}

/**
 * Imperative confirm/discard dialog (reference AS.03, "dialog over scrim").
 *
 * `confirm()` returns a promise so a destructive action can `await` the
 * decision inline — `if (!(await confirm({ title: '…' }))) return` — instead
 * of threading dialog-open state through the caller.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const root = useRef<HTMLDivElement>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => setPending({ ...options, resolve }))
  }, [])

  const settle = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  useDismiss(root, pending !== null, () => settle(false))

  const node = pending
    ? createPortal(
        <div className="plate-dialog-scrim">
          <div className="plate-dialog" ref={root} role="alertdialog" aria-modal="true" aria-label={pending.title}>
            <div className="plate-dialog-body">
              <b>{pending.title}</b>
              {pending.description && <span>{pending.description}</span>}
            </div>
            <div className="plate-dialog-actions">
              <button type="button" onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Keep'}
              </button>
              <button type="button" className={pending.danger ? 'is-danger' : ''} onClick={() => settle(true)} autoFocus>
                {pending.confirmLabel ?? 'Discard'}
              </button>
            </div>
          </div>
        </div>,
        workspacePortalTarget(),
      )
    : null

  return { confirm, node }
}
