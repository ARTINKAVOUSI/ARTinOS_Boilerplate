import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { controls } from './control-registry'

/** Button — the workbench's subtle button (reference `.subtle-button`). */
export function Button({
  children,
  active = false,
  disabled = false,
  title,
  className,
  onClick,
  ...rest
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  title?: string
  /** Added to the component class, never replacing it. */
  className?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'title' | 'disabled' | 'type'>) {
  return (
    <button
      type="button"
      className={[active ? 'artinos-button is-active' : 'artinos-button', className].filter(Boolean).join(' ')}
      disabled={disabled}
      title={title}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  )
}

/** IconButton — a bare glyph button (reference `.icon`). */
export function IconButton({
  children,
  active = false,
  title,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  title?: string
  onClick(): void
}) {
  return (
    <button type="button" className={active ? 'artinos-icon-button is-active' : 'artinos-icon-button'} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Collapsible — the workbench folder (reference `details.folder`): a chevron, a
 * quiet caps summary and a rule running to the edge. Folders nest with an indent.
 *
 * `open` forces the folder open or closed when it changes (a search that must
 * reveal every match); the user can still toggle it afterwards.
 */
export function Collapsible({
  title,
  children,
  defaultOpen = true,
  open,
  badge,
  onOpenChange,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  badge?: ReactNode
  onOpenChange?(open: boolean): void
}) {
  const [isOpen, setOpen] = useState(open ?? defaultOpen)
  useEffect(() => {
    if (open !== undefined) setOpen(open)
  }, [open])
  return (
    <details
      className="artinos-folder"
      open={isOpen}
      onToggle={event => {
        const next = event.currentTarget.open
        if (next === isOpen) return
        setOpen(next)
        onOpenChange?.(next)
      }}
    >
      <summary>
        {title}
        {badge}
      </summary>
      {children}
    </details>
  )
}

Button.meta = controls.require('button')
IconButton.meta = controls.require('icon-button')
Collapsible.meta = controls.require('collapsible')
