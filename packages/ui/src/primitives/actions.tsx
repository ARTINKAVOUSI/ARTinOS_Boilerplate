import { useState, type ReactNode } from 'react'
import { controls } from './control-registry'

export function Button({
  children,
  active = false,
  disabled = false,
  title,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  title?: string
  onClick(): void
}) {
  return (
    <button className={`artinos-button ${active ? 'is-active' : ''}`} disabled={disabled} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

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
    <button className={`artinos-icon-button ${active ? 'is-active' : ''}`} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  )
}

export function Collapsible({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  badge?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="artinos-collapsible">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span>
        {badge}
        <i>{open ? '−' : '+'}</i>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

Button.meta = controls.require('button')
IconButton.meta = controls.require('icon-button')
Collapsible.meta = controls.require('collapsible')
