import { useEffect, type RefObject } from 'react'

/** Closes a transient surface on Escape or on a pointer press outside of it. */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onDismiss()
    }
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss()
    }
    // Capture phase, so a click that also opens another surface cannot race this one.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [ref, open, onDismiss])
}

export interface Shortcut {
  key: string
  /** Requires Cmd on macOS or Ctrl elsewhere. */
  meta?: boolean
}

/** Registers a global shortcut. Bare-key shortcuts ignore keystrokes aimed at a text field. */
export function useShortcut(shortcut: Shortcut, handler: () => void): void {
  const { key, meta } = shortcut
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      if (meta && !(event.metaKey || event.ctrlKey)) return
      const target = event.target as HTMLElement | null
      const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      if (!meta && typing) return
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, meta, handler])
}
