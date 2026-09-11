import { usePanelHost } from './panel-host'
import { PANEL_MIME } from './PanelFrame'
import type { EdgeDock } from './panel-types'

/** Compact launcher strip: one entry per panel, showing where it currently lives. */
export function PanelRail({ dock }: { dock: EdgeDock }) {
  const host = usePanelHost()

  return (
    <nav className="plate-panel-rail" aria-label="Workspace panels">
      {host.definitions
        .filter(definition => definition.rail !== false)
        .map(definition => {
          const state = host.layout[definition.id]
          const active = Boolean(state?.visible && state.dock === dock)
          return (
            <button
              key={definition.id}
              className={active ? 'is-active' : ''}
              draggable
              onDragStart={event => {
                event.dataTransfer.setData(PANEL_MIME, definition.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => (active ? host.toggleVisible(definition.id) : host.show(definition.id, dock))}
              title={definition.description ?? definition.title}
              aria-pressed={active}
            >
              <span>{definition.title}</span>
            </button>
          )
        })}
    </nav>
  )
}
