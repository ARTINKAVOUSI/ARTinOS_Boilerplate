import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Menu.css'

export type MenuEntry =
  | { type?: 'item'; id: string; label: ReactNode; icon?: ReactNode; shortcut?: string; disabled?: boolean; danger?: boolean; checked?: boolean; onSelect: () => void }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode }

export interface MenuProps {
  /** The trigger — one button. It is wired to open the menu. */
  trigger: ReactElement<Record<string, unknown>>
  items: readonly MenuEntry[]
  align?: 'start' | 'end'
}

type Item = Extract<MenuEntry, { onSelect: () => void }>
const isItem = (entry: MenuEntry): entry is Item => entry.type === undefined || entry.type === 'item'

/**
 * Menu — a dropdown of actions opened from a button. Arrow keys move,
 * Enter selects, Escape or an outside click closes and returns focus.
 */
export function Menu({ trigger, items, align = 'start' }: MenuProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const enabled = items.map((entry, index) => (isItem(entry) && !entry.disabled ? index : -1)).filter(index => index >= 0)

  const close = (restore = true) => {
    setOpen(false)
    setPosition(null)
    if (restore) anchor.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !anchor.current || !list.current) return
    const a = anchor.current.getBoundingClientRect()
    const m = list.current.getBoundingClientRect()
    let left = align === 'end' ? a.right - m.width : a.left
    let top = a.bottom + 4
    if (top + m.height > window.innerHeight - 4) top = Math.max(4, a.top - m.height - 4)
    left = Math.min(window.innerWidth - m.width - 4, Math.max(4, left))
    setPosition({ left, top })
    list.current.focus()
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!list.current?.contains(target) && !anchor.current?.contains(target)) close(false)
    }
    window.addEventListener('pointerdown', onPointer, true)
    return () => window.removeEventListener('pointerdown', onPointer, true)
  }, [open])

  const select = (index: number) => {
    const entry = items[index]
    if (!entry || !isItem(entry) || entry.disabled) return
    close()
    entry.onSelect()
  }

  const button = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    onClick: (event: MouseEvent) => {
      ;(trigger.props.onClick as ((event: MouseEvent) => void) | undefined)?.(event)
      anchor.current = event.currentTarget as HTMLElement
      if (open) close(false)
      else {
        setActive(-1)
        setOpen(true)
      }
    },
  })

  return (
    <>
      {button}
      {open &&
        createPortal(
          <div
            ref={list}
            id={id}
            role="menu"
            tabIndex={-1}
            className="aui-menu"
            style={{ left: position?.left ?? -9999, top: position?.top ?? -9999, opacity: position ? 1 : 0 }}
            onKeyDown={event => {
              const at = enabled.indexOf(active)
              if (event.key === 'ArrowDown') setActive(enabled[(at + 1) % enabled.length] ?? -1)
              else if (event.key === 'ArrowUp') setActive(enabled[(at - 1 + enabled.length) % enabled.length] ?? -1)
              else if (event.key === 'Home') setActive(enabled[0] ?? -1)
              else if (event.key === 'End') setActive(enabled[enabled.length - 1] ?? -1)
              else if (event.key === 'Enter' || event.key === ' ') select(active)
              else if (event.key === 'Escape' || event.key === 'Tab') close(event.key === 'Escape')
              else return
              event.preventDefault()
            }}
          >
            {items.map((entry, index) => {
              if (entry.type === 'separator') return <div key={index} className="aui-menu__separator" role="separator" />
              if (entry.type === 'label') return <div key={index} className="aui-menu__label">{entry.label}</div>
              return (
                <div
                  key={entry.id}
                  role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                  aria-checked={entry.checked}
                  aria-disabled={entry.disabled || undefined}
                  className="aui-menu__item"
                  data-active={index === active || undefined}
                  data-danger={entry.danger || undefined}
                  onPointerEnter={() => !entry.disabled && setActive(index)}
                  onClick={() => select(index)}
                >
                  <span className="aui-menu__icon">
                    {entry.checked ? (
                      <svg viewBox="0 0 12 12" aria-hidden>
                        <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                      </svg>
                    ) : (
                      entry.icon
                    )}
                  </span>
                  <span className="aui-menu__text">{entry.label}</span>
                  {entry.shortcut && <span className="aui-menu__shortcut">{entry.shortcut}</span>}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}

export default Menu
