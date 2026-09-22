import { useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDismiss, useFocusScope, useRovingCollection, workspacePortalTarget } from '../headless'

function useOpen(value: boolean | undefined, initial: boolean, onChange?: (open: boolean) => void) {
  const [local, setLocal] = useState(initial)
  const open = value ?? local
  const setOpen = (next: boolean) => { if (value === undefined) setLocal(next); onChange?.(next) }
  return [open, setOpen] as const
}

export interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?(open: boolean): void
  label?: string
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}

export function Popover({ trigger, children, open: controlled, defaultOpen = false, onOpenChange, label, placement = 'bottom-start' }: PopoverProps) {
  const [open, setOpen] = useOpen(controlled, defaultOpen, onOpenChange)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const id = useId()
  useDismiss(contentRef, open, () => setOpen(false))
  const rect = triggerRef.current?.getBoundingClientRect()
  const top = placement.startsWith('top') ? (rect?.top ?? 0) : (rect?.bottom ?? 0)
  const left = placement.endsWith('end') ? (rect?.right ?? 0) : (rect?.left ?? 0)
  return (
    <>
      <button ref={triggerRef} type="button" className="artinos-overlay-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{trigger}</button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div id={id} ref={contentRef} className="artinos-popover" role="dialog" aria-label={label} data-placement={placement} style={{ position: 'fixed', top, left }}>
          {children}
        </div>,
        workspacePortalTarget(),
      ) : null}
    </>
  )
}

export function Tooltip({ content, children, delay = 350 }: { content: ReactNode; children: ReactNode; delay?: number }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  const show = () => { timer.current = setTimeout(() => setOpen(true), delay) }
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setOpen(false) }
  return (
    <span className="artinos-tooltip-anchor" tabIndex={0} aria-describedby={open ? id : undefined} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && <span id={id} className="artinos-tooltip" role="tooltip">{content}</span>}
    </span>
  )
}

export interface MenuItem {
  id: string
  label: string
  disabled?: boolean
  shortcut?: string
  danger?: boolean
  onSelect(): void
}

export function Menu({ items, onClose }: { items: MenuItem[]; onClose?(): void }) {
  const collection = useRovingCollection(items, {
    orientation: 'vertical',
    onActivate: id => {
      const item = items.find(candidate => candidate.id === id)
      if (!item || item.disabled) return
      item.onSelect(); onClose?.()
    },
  })
  return (
    <div className="artinos-menu" role="menu">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={collection.tabIndex(item.id)}
          data-danger={item.danger || undefined}
          onFocus={() => collection.setActiveId(item.id)}
          onKeyDown={event => collection.onKeyDown(event, item.id)}
          onClick={() => { item.onSelect(); onClose?.() }}
        >
          <span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}
        </button>
      ))}
    </div>
  )
}

export function ContextMenu({ children, items }: { children: ReactNode; items: MenuItem[] }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, point !== null, () => setPoint(null))
  return (
    <div className="artinos-context-anchor" onContextMenu={event => { event.preventDefault(); setPoint({ x: event.clientX, y: event.clientY }) }}>
      {children}
      {point && typeof document !== 'undefined' ? createPortal(
        <div ref={ref} className="artinos-context-menu" style={{ position: 'fixed', left: point.x, top: point.y }}>
          <Menu items={items} onClose={() => setPoint(null)} />
        </div>,
        workspacePortalTarget(),
      ) : null}
    </div>
  )
}

export interface DialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  modal?: boolean
}

export function Dialog({ open, onOpenChange, title, description, children, actions, modal = true }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  useDismiss(ref, open, () => onOpenChange(false))
  useFocusScope(ref, open, { contain: modal })
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="artinos-dialog-scrim" data-modal={modal || undefined}>
      <div ref={ref} className="artinos-dialog" role="dialog" aria-modal={modal} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close" onClick={() => onOpenChange(false)}>×</button></header>
        {description && <p id={descriptionId}>{description}</p>}
        <div className="artinos-dialog-content">{children}</div>
        {actions && <footer>{actions}</footer>}
      </div>
    </div>,
    workspacePortalTarget(),
  )
}

export function Drawer({ side = 'right', ...props }: DialogProps & { side?: 'left' | 'right' | 'top' | 'bottom' }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDismiss(ref, props.open, () => props.onOpenChange(false))
  useFocusScope(ref, props.open)
  if (!props.open || typeof document === 'undefined') return null
  return createPortal(
    <div className="artinos-dialog-scrim">
      <aside ref={ref} className="artinos-drawer" data-side={side} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header><h2 id={titleId}>{props.title}</h2><button type="button" aria-label="Close" onClick={() => props.onOpenChange(false)}>×</button></header>
        {props.description && <p>{props.description}</p>}
        <div className="artinos-dialog-content">{props.children}</div>
        {props.actions && <footer>{props.actions}</footer>}
      </aside>
    </div>,
    workspacePortalTarget(),
  )
}
