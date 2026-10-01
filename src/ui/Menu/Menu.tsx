import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Menu.css'

export type MenuEntry =
  | { type?: 'item'; id: string; label: ReactNode; icon?: ReactNode; shortcut?: string; disabled?: boolean; danger?: boolean; checked?: boolean; onSelect: () => void }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode }

const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()

type Item = Extract<MenuEntry, { onSelect: () => void }>
const isItem = (entry: MenuEntry): entry is Item => entry.type === undefined || entry.type === 'item'

/** Where the list opens: under an element (a button) or at a point (a right-click). */
type Anchor = { rect: DOMRect; align: 'start' | 'end' } | { x: number; y: number }

/**
 * The list both menus share: portalled, placed to stay on screen, keyboard
 * driven (arrows, Home, End, Enter, Escape), closed by an outside press.
 */
function MenuList({ items, anchor, onClose, owner }: { items: readonly MenuEntry[]; anchor: Anchor; onClose: (restoreFocus: boolean) => void; owner?: HTMLElement | null }) {
  const id = useId()
  const list = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const enabled = items.map((entry, index) => (isItem(entry) && !entry.disabled ? index : -1)).filter(index => index >= 0)

  useLayoutEffect(() => {
    if (!list.current) return
    const m = list.current.getBoundingClientRect()
    let left: number
    let top: number
    if ('rect' in anchor) {
      left = anchor.align === 'end' ? anchor.rect.right - m.width : anchor.rect.left
      top = anchor.rect.bottom + 4
      if (top + m.height > window.innerHeight - 4) top = Math.max(4, anchor.rect.top - m.height - 4)
    } else {
      left = anchor.x
      top = anchor.y
      if (top + m.height > window.innerHeight - 4) top = Math.max(4, anchor.y - m.height)
    }
    left = Math.min(window.innerWidth - m.width - 4, Math.max(4, left))
    setPosition({ left, top })
    list.current.focus()
  }, [anchor])

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      // A press on the trigger itself is its own click: it toggles the menu.
      if (!list.current?.contains(target) && !owner?.contains(target)) onClose(false)
    }
    const onScroll = () => onClose(false)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('blur', onScroll)
    window.addEventListener('wheel', onScroll, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('blur', onScroll)
      window.removeEventListener('wheel', onScroll)
    }
  }, [onClose, owner])

  const select = (index: number) => {
    const entry = items[index]
    if (!entry || !isItem(entry) || entry.disabled) return
    onClose(true)
    entry.onSelect()
  }

  return createPortal(
    <div
      ref={list}
      id={id}
      role="menu"
      tabIndex={-1}
      className="ar-menu"
      style={{ left: position?.left ?? -9999, top: position?.top ?? -9999, opacity: position ? 1 : 0 }}
      // A portal's events still bubble up the React tree, to whatever rendered
      // the menu: a drag handle there (a dock strip) would start a drag.
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={event => {
        event.stopPropagation()
        const at = enabled.indexOf(active)
        if (event.key === 'ArrowDown') setActive(enabled[(at + 1) % enabled.length] ?? -1)
        else if (event.key === 'ArrowUp') setActive(enabled[(at - 1 + enabled.length) % enabled.length] ?? -1)
        else if (event.key === 'Home') setActive(enabled[0] ?? -1)
        else if (event.key === 'End') setActive(enabled[enabled.length - 1] ?? -1)
        else if (event.key === 'Enter' || event.key === ' ') select(active)
        else if (event.key === 'Escape' || event.key === 'Tab') onClose(event.key === 'Escape')
        else return
        event.preventDefault()
      }}
    >
      {items.map((entry, index) => {
        if (entry.type === 'separator') return <div key={index} className="ar-menu__separator" role="separator" />
        if (entry.type === 'label') return <div key={index} className="ar-menu__label">{entry.label}</div>
        return (
          <div
            key={entry.id}
            role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={entry.checked}
            aria-disabled={entry.disabled || undefined}
            className="ar-menu__item"
            data-active={index === active || undefined}
            data-danger={entry.danger || undefined}
            onPointerEnter={() => !entry.disabled && setActive(index)}
            onClick={() => select(index)}
          >
            <span className="ar-menu__icon">
              {entry.checked ? (
                <svg viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                </svg>
              ) : (
                entry.icon
              )}
            </span>
            <span className="ar-menu__text">{entry.label}</span>
            {entry.shortcut && <span className="ar-menu__shortcut">{entry.shortcut}</span>}
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

export interface MenuProps {
  /** The trigger — one button. It is wired to open the menu. */
  trigger: ReactElement<Record<string, unknown>>
  items: readonly MenuEntry[]
  align?: 'start' | 'end'
}

/** Menu — a dropdown of actions opened from a button. */
export function Menu({ trigger, items, align = 'start' }: MenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const button = useRef<HTMLElement | null>(null)

  const close = (restoreFocus: boolean) => {
    setAnchor(null)
    if (restoreFocus) button.current?.focus()
  }

  const wired = cloneElement(trigger, {
    'aria-haspopup': 'menu',
    'aria-expanded': anchor !== null,
    onClick: (event: MouseEvent) => {
      ;(trigger.props.onClick as ((event: MouseEvent) => void) | undefined)?.(event)
      button.current = event.currentTarget as HTMLElement
      setAnchor(open => (open ? null : { rect: button.current!.getBoundingClientRect(), align }))
    },
  })

  return (
    <>
      {wired}
      {anchor && <MenuList items={items} anchor={anchor} onClose={close} owner={button.current} />}
    </>
  )
}

export interface ContextMenuProps {
  /** Built when the menu opens, so it always reflects the current value. */
  items: () => readonly MenuEntry[]
  children: ReactNode
  /** Off, the browser's own menu shows instead. */
  disabled?: boolean
}

/**
 * ContextMenu — the same menu, opened by a right-click (or the keyboard's
 * Menu key / Shift+F10) anywhere inside its children. It adds no box of its
 * own (`display: contents`), so wrapping a row never changes the layout.
 */
export function ContextMenu({ items, children, disabled = false }: ContextMenuProps) {
  const [open, setOpen] = useState<{ anchor: Anchor; items: readonly MenuEntry[]; from: HTMLElement | null } | null>(null)

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled) return
    // Text fields keep the browser's menu (cut, copy, paste, spelling).
    const target = event.target as HTMLElement
    if (target.closest('input, textarea, [contenteditable="true"]')) return
    event.preventDefault()
    // Handled here: an outer right-click handler (the dock's panel menu) must not open too.
    event.stopPropagation()
    const keyboard = event.clientX === 0 && event.clientY === 0
    const rect = target.getBoundingClientRect()
    const anchor: Anchor = keyboard ? { x: rect.left, y: rect.bottom + 4 } : { x: event.clientX, y: event.clientY }
    setOpen({ anchor, items: items(), from: document.activeElement as HTMLElement | null })
  }

  return (
    <div className="ar-context" onContextMenu={onContextMenu}>
      {children}
      {open && (
        <MenuList
          items={open.items}
          anchor={open.anchor}
          onClose={restoreFocus => {
            if (restoreFocus) open.from?.focus?.()
            setOpen(null)
          }}
        />
      )}
    </div>
  )
}

export default Menu
