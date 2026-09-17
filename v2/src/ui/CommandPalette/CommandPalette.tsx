import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './CommandPalette.css'

export interface Command {
  id: string
  label: string
  /** Heading the command is listed under. */
  group?: string
  /** Extra words that should match. */
  keywords?: string
  /** Shortcut hint, e.g. "H". Display only. */
  shortcut?: string
  icon?: ReactNode
  run: () => void
}

export interface CommandPaletteProps {
  commands: readonly Command[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Global shortcut that toggles the palette. `null` disables it. Default Ctrl/⌘ + K. */
  hotkey?: { key: string; mod?: boolean; shift?: boolean } | null
  placeholder?: string
}

/** Subsequence match with a bonus for word starts and contiguous runs. */
function score(query: string, text: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct >= 0) return 100 - direct + (direct === 0 || t[direct - 1] === ' ' ? 50 : 0)
  let at = 0
  let total = 0
  let run = 0
  for (const char of q) {
    const found = t.indexOf(char, at)
    if (found < 0) return 0
    run = found === at ? run + 1 : 0
    total += 1 + run + (found === 0 || t[found - 1] === ' ' ? 3 : 0)
    at = found + 1
  }
  return total
}

/**
 * CommandPalette — a searchable list of every action, opened with Ctrl/⌘+K.
 * Arrow keys move, Enter runs, Escape closes.
 */
export function CommandPalette({ commands, open, onOpenChange, hotkey = { key: 'k', mod: true }, placeholder = 'Type a command…' }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const restore = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!hotkey) return
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (event.key.toLowerCase() !== hotkey.key.toLowerCase() || !!hotkey.mod !== mod || !!hotkey.shift !== event.shiftKey) return
      event.preventDefault()
      onOpenChange(!open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkey, open, onOpenChange])

  useEffect(() => {
    if (open) {
      restore.current = document.activeElement as HTMLElement | null
      setQuery('')
      setActive(0)
      setTimeout(() => input.current?.focus(), 0)
    } else {
      restore.current?.focus?.()
    }
  }, [open])

  const results = useMemo(() => {
    return commands
      .map(command => ({ command, score: Math.max(score(query, command.label), score(query, `${command.group ?? ''} ${command.keywords ?? ''}`) * 0.5) }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => (query ? b.score - a.score : 0))
      .map(entry => entry.command)
  }, [commands, query])

  useEffect(() => {
    list.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (command: Command | undefined) => {
    if (!command) return
    onOpenChange(false)
    // Let the palette close (and focus return) before the command acts.
    setTimeout(() => command.run(), 0)
  }

  let lastGroup: string | undefined
  return createPortal(
    <div className="aui-palette" onPointerDown={event => event.target === event.currentTarget && onOpenChange(false)}>
      <div className="aui-palette__dialog" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="aui-palette__search">
          <svg viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="aui-palette-list"
            aria-activedescendant={results[active] ? `aui-cmd-${results[active].id}` : undefined}
            placeholder={placeholder}
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') setActive(i => Math.min(results.length - 1, i + 1))
              else if (event.key === 'ArrowUp') setActive(i => Math.max(0, i - 1))
              else if (event.key === 'Enter') run(results[active])
              else if (event.key === 'Escape') onOpenChange(false)
              else return
              event.preventDefault()
            }}
          />
        </div>
        <div ref={list} id="aui-palette-list" role="listbox" className="aui-palette__list">
          {results.length === 0 && <div className="aui-palette__empty">No matching commands</div>}
          {results.map((command, index) => {
            const heading = !query && command.group !== lastGroup ? command.group : undefined
            lastGroup = command.group
            return (
              <div key={command.id}>
                {heading && <div className="aui-palette__group">{heading}</div>}
                <div
                  id={`aui-cmd-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active || undefined}
                  className="aui-palette__item"
                  onPointerMove={() => setActive(index)}
                  onClick={() => run(command)}
                >
                  <span className="aui-palette__icon">{command.icon}</span>
                  <span className="aui-palette__label">{command.label}</span>
                  {query && command.group && <span className="aui-palette__meta">{command.group}</span>}
                  {command.shortcut && <kbd>{command.shortcut}</kbd>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default CommandPalette
