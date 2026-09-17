import { useEffect, useRef, useState } from 'react'
import { useDismiss } from '../headless'
import { useConfirmDialog } from './ConfirmDialog'
import { usePanelHost } from './panel-host'
import { useWorkspaceLayout, useWorkspaceTheme, type WorkspaceTheme } from './workspace-context'
import type { EdgeDock } from './panel-types'

const POSITIONS: Array<{ id: EdgeDock; label: string }> = [
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

const SIZES: Array<{ id: 'min' | 'default' | 'max'; label: string }> = [
  { id: 'min', label: 'Narrow' },
  { id: 'default', label: 'Default' },
  { id: 'max', label: 'Extended' },
]

const THEMES: Array<{ id: WorkspaceTheme; label: string }> = [
  { id: 'workbench', label: 'Workbench' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'auto', label: 'Auto' },
]

const DOCK_SIZES = {
  bottom: { min: 230, max: () => Math.round(innerHeight * 0.68), default: 276 },
  left: { min: 280, max: () => 720, default: 424 },
  right: { min: 280, max: () => 720, default: 424 },
} as const

/**
 * Workspace controls.
 *
 * The trigger is the `⋯` in the status cluster. The popup opens *upward* so it
 * sits above the dock rather than covering the panels the controls act on, and
 * every row is a segmented control — the same component the panels use, so the
 * popup reads as part of the surface instead of a foreign menu.
 */
export function DockControls() {
  const host = usePanelHost()
  const { layout, setLayout } = useWorkspaceLayout()
  const { theme, setTheme } = useWorkspaceTheme()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useDismiss(root, open, () => setOpen(false))
  const { confirm, node: confirmDialog } = useConfirmDialog()

  /**
   * Proximity open. A short delay in both directions is what separates
   * "reaching for it" from "passing over it": without the open delay the panel
   * fires on every sweep across the strip, and without the close delay it shuts
   * while the pointer crosses the gap to reach it.
   */
  const timer = useRef<number | null>(null)
  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }
  const openSoon = () => {
    clear()
    if (!open) timer.current = window.setTimeout(() => setOpen(true), 120)
  }
  const closeSoon = () => {
    clear()
    timer.current = window.setTimeout(() => setOpen(false), 260)
  }
  useEffect(() => clear, [])

  const activeDock: EdgeDock = layout.leftOpen ? 'left' : layout.rightOpen ? 'right' : 'bottom'

  const dockAll = (dock: EdgeDock) => {
    const visible = Object.entries(host.layout)
      .filter(([, s]) => s.visible)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id]) => id)
    host.solo(visible.length ? visible : host.definitions.slice(0, 3).map(d => d.id), dock)
    setLayout({ leftOpen: dock === 'left', rightOpen: dock === 'right', bottomOpen: dock === 'bottom' })
  }

  const setSize = (preset: 'min' | 'default' | 'max') => {
    const limits = DOCK_SIZES[activeDock]
    const value = preset === 'min' ? limits.min : preset === 'max' ? limits.max() : limits.default
    setLayout(activeDock === 'bottom' ? { bottom: value } : activeDock === 'left' ? { left: value } : { right: value })
  }

  return (
    <div
      className="plate-dock-controls"
      ref={root}
      onPointerEnter={openSoon}
      onPointerLeave={closeSoon}
    >
      <button
        type="button"
        className={`plate-dock-controls-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Workspace controls"
        title="Workspace controls"
      >
        ⋯
      </button>

      {open && (
        <div className="plate-dock-popup" role="dialog" aria-label="Workspace controls">
          <section>
            <header>Position</header>
            <div className="plate-seg" role="group" aria-label="Dock position">
              {POSITIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={activeDock === id ? 'is-active' : ''}
                  aria-pressed={activeDock === id}
                  onClick={() => dockAll(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <header>Size</header>
            <div className="plate-seg" role="group" aria-label="Dock size">
              {SIZES.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setSize(id)}>
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <header>Theme</header>
            <div className="plate-seg" role="group" aria-label="Appearance">
              {THEMES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={theme === id ? 'is-active' : ''}
                  aria-pressed={theme === id}
                  onClick={() => setTheme(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            className="plate-dock-popup-reset"
            onClick={async () => {
              setOpen(false)
              const ok = await confirm({
                title: 'Reset workspace layout?',
                description: 'Docked panels and their sizes return to the default arrangement.',
                confirmLabel: 'Reset',
                danger: true,
              })
              if (ok) host.reset()
            }}
          >
            Reset layout
          </button>
        </div>
      )}
      {confirmDialog}
    </div>
  )
}
