import { useState, type ReactNode } from 'react'
import { useWorkspaceLayout } from './workspace-context'
import type { EdgeDock } from './panel-types'

const LIMITS: Record<EdgeDock, { min: number; max: () => number }> = {
  left: { min: 260, max: () => 720 },
  right: { min: 280, max: () => 760 },
  bottom: { min: 230, max: () => Math.round(innerHeight * 0.72) },
}

/** One edge of the workspace grid: a resizable strip that hosts docked panels. */
export function DockArea({ dock, children, chrome, rail }: { dock: EdgeDock; children: ReactNode; chrome?: ReactNode; rail?: ReactNode }) {
  const { layout, setLayout } = useWorkspaceLayout()
  const open = dock === 'left' ? layout.leftOpen : dock === 'right' ? layout.rightOpen : layout.bottomOpen
  const size = dock === 'left' ? layout.left : dock === 'right' ? layout.right : layout.bottom

  const resize = (event: React.PointerEvent) => {
    event.preventDefault()
    const origin = dock === 'bottom' ? event.clientY : event.clientX
    const start = size
    const limit = LIMITS[dock]

    const move = (next: PointerEvent) => {
      // Right and bottom docks grow towards the origin, so their delta is inverted.
      const delta = dock === 'left' ? next.clientX - origin : dock === 'right' ? origin - next.clientX : origin - next.clientY
      const value = Math.max(limit.min, Math.min(limit.max(), start + delta))
      setLayout(dock === 'left' ? { left: value } : dock === 'right' ? { right: value } : { bottom: value })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!open) return null
  return (
    <aside className={`artinos-dock artinos-dock-${dock} plate-dock`}>
      {chrome}
      <div className="plate-dock-content">{children}</div>
      {rail}
      <div className="artinos-resizer" onPointerDown={resize} />
    </aside>
  )
}

/** Standalone collapsible panel, for shells that do not use the dock manager. */
export function Panel({
  title,
  children,
  dock = 'right',
  defaultOpen = true,
  toolbar,
}: {
  title: string
  children: ReactNode
  dock?: EdgeDock | 'float'
  defaultOpen?: boolean
  toolbar?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`artinos-panel artinos-panel-${dock} ${open ? 'is-open' : 'is-closed'}`}>
      <div className="artinos-panel-header">
        <button onClick={() => setOpen(value => !value)} aria-expanded={open}>
          <span>{title}</span>
          <span>{open ? '−' : '+'}</span>
        </button>
        {toolbar && <div className="artinos-panel-toolbar">{toolbar}</div>}
      </div>
      {open && <div className="artinos-panel-body">{children}</div>}
    </section>
  )
}
