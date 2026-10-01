import { useEffect, useRef, useState } from 'react'
import { useConsoleEntries } from '../console'
import './ConsoleToast.css'

const LINGER_MS = { warn: 6000, error: 10000 } as const

/**
 * The latest warning or error, top-right, opposite the brand chip. It speaks
 * once per new message: the same message repeating only raises its ×count, so
 * a renderer error firing every frame does not pin it to the screen. Hover
 * holds it, the message opens the Console panel, × dismisses it.
 */
export function ConsoleToast({ onOpen }: { onOpen?: () => void }) {
  const entries = useConsoleEntries()
  const notable = entries.filter(entry => entry.level === 'warn' || entry.level === 'error')
  const latest = notable.at(-1)
  const level = latest?.level === 'error' ? 'error' : 'warn'
  const key = latest ? `${latest.level}:${latest.message}` : null
  const repeats = latest ? notable.filter(entry => entry.level === latest.level && entry.message === latest.message).length : 0
  const [visible, setVisible] = useState(false)
  const hovered = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const hideLater = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => !hovered.current && setVisible(false), LINGER_MS[level])
  }

  useEffect(() => {
    if (!key) return
    setVisible(true)
    hideLater()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!latest) return null
  return (
    <output
      className="plate-console-toast"
      data-level={level}
      data-visible={visible || undefined}
      aria-live={level === 'error' ? 'assertive' : 'polite'}
      onPointerEnter={() => {
        hovered.current = true
        window.clearTimeout(timer.current)
      }}
      onPointerLeave={() => {
        hovered.current = false
        hideLater()
      }}
    >
      <button
        type="button"
        className="plate-console-toast-open"
        title={`${latest.message}\n\nOpen the Console`}
        onClick={() => {
          setVisible(false)
          onOpen?.()
        }}
      >
        <i aria-hidden />
        <span className="plate-console-toast-message">{latest.message}</span>
        {repeats > 1 && <small aria-label={`${repeats} times`}>×{repeats >= 500 ? '500+' : repeats}</small>}
      </button>
      <button type="button" className="plate-console-toast-close" aria-label="Dismiss" onClick={() => setVisible(false)}>
        <svg viewBox="0 0 10 10" aria-hidden>
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </output>
  )
}
