import { useEffect, useRef, useState } from 'react'
import { useConsoleEntries } from '../console'

const LINGER_MS = 5000

/**
 * The latest warning or error, briefly, over the canvas. Errors stay until
 * hovered away; the count opens the Console panel.
 */
export function ConsoleToast({ onOpen }: { onOpen?: () => void }) {
  const entries = useConsoleEntries()
  const notable = entries.filter(entry => entry.level === 'warn' || entry.level === 'error')
  const latest = notable.at(-1)
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)
  const level = latest?.level ?? 'info'

  useEffect(() => {
    if (!latest) return
    setVisible(true)
    if (timer.current) window.clearTimeout(timer.current)
    if (level !== 'error') timer.current = window.setTimeout(() => setVisible(false), LINGER_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [latest?.id, level])

  if (!latest) return null
  return (
    <output
      className="plate-console-toast"
      data-level={level}
      data-visible={visible || undefined}
      aria-live={level === 'error' ? 'assertive' : 'polite'}
      onPointerEnter={() => {
        if (timer.current) window.clearTimeout(timer.current)
        setVisible(true)
      }}
      onPointerLeave={() => {
        timer.current = window.setTimeout(() => setVisible(false), level === 'error' ? LINGER_MS * 2 : LINGER_MS)
      }}
    >
      <i aria-hidden />
      <span className="plate-console-toast-message">{latest.message}</span>
      <button type="button" className="plate-console-toast-open" onClick={onOpen} aria-label="Open console" title="Open console">
        {notable.length}
      </button>
    </output>
  )
}
