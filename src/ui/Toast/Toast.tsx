import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Toast.css'

export interface ToastOptions {
  title: ReactNode
  description?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'error'
  /** Milliseconds; 0 keeps it until dismissed. Default 3500. */
  duration?: number
  action?: { label: string; onClick: () => void }
}

interface ToastEntry extends ToastOptions {
  id: number
}

type Notify = (options: ToastOptions) => () => void

const ToastContext = createContext<Notify | null>(null)

/**
 * Toasts — brief, non-blocking notifications. Wrap the app once in
 * <ToastProvider>, then call `useToast()(options)` anywhere below it.
 * Messages are announced to screen readers through a polite live region.
 */
export function ToastProvider({ children, placement = 'bottom-right' }: { children?: ReactNode; placement?: 'bottom-right' | 'bottom-center' | 'top-right' }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const next = useRef(0)

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(toast => toast.id !== id)), [])
  const notify = useCallback<Notify>(
    options => {
      const id = ++next.current
      setToasts(list => [...list.slice(-4), { ...options, id }])
      return () => dismiss(id)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {createPortal(
        <div className="aui-toasts" data-placement={placement} role="status" aria-live="polite">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const { id } = toast
  const [paused, setPaused] = useState(false)
  const duration = toast.duration ?? 3500
  useEffect(() => {
    if (!duration || paused) return
    const timer = setTimeout(() => onDismiss(id), duration)
    return () => clearTimeout(timer)
  }, [duration, paused, onDismiss, id])
  return (
    <div className="aui-toast" data-tone={toast.tone ?? 'neutral'} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <span className="aui-toast__dot" aria-hidden />
      <div className="aui-toast__text">
        <strong>{toast.title}</strong>
        {toast.description && <span>{toast.description}</span>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="aui-toast__action"
          onClick={() => {
            toast.action!.onClick()
            onDismiss(id)
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="aui-toast__close" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
        </svg>
      </button>
    </div>
  )
}

/** Returns `notify(options)`; outside a provider it logs to the console instead. */
export function useToast(): Notify {
  const notify = useContext(ToastContext)
  return useMemo<Notify>(
    () =>
      notify ??
      (options => {
        console.info('[toast]', options.title, options.description ?? '')
        return () => {}
      }),
    [notify],
  )
}

export default ToastProvider
