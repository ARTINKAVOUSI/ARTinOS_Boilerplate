import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',')

export interface FocusScopeOptions {
  contain?: boolean
  restoreFocus?: boolean
  autoFocus?: boolean
}

export function useFocusScope(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusScopeOptions = {},
): void {
  const { contain = true, restoreFocus = true, autoFocus = true } = options
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
    if (autoFocus) queueMicrotask(() => (focusable()[0] ?? ref.current)?.focus())
    const onKeyDown = (event: KeyboardEvent) => {
      if (!contain || event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); ref.current?.focus(); return }
      const current = items.indexOf(document.activeElement as HTMLElement)
      const next = event.shiftKey
        ? (current <= 0 ? items.length - 1 : current - 1)
        : (current < 0 || current === items.length - 1 ? 0 : current + 1)
      event.preventDefault()
      items[next]?.focus()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      if (restoreFocus && previous?.isConnected) previous.focus()
    }
  }, [active, autoFocus, contain, ref, restoreFocus])
}
