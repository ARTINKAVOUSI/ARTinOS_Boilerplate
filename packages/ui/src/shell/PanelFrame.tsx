import { Minimize2, Move, PictureInPicture2, X } from 'lucide-react'
import { panelWeight } from './panel-layout'
import { usePanelHost } from './panel-host'
import type { PanelDefinition, PanelState } from './panel-types'

const PANEL_MIME = 'application/x-artinos-panel'

/** Chrome for one managed panel: header, drag handle, float/focus/close, resize grip. */
export function PanelFrame({ definition, state }: { definition: PanelDefinition; state: PanelState }) {
  const host = usePanelHost()
  const Icon = definition.icon
  const floating = state.dock === 'float'

  const startDrag = (event: React.DragEvent) => {
    event.dataTransfer.setData(PANEL_MIME, definition.id)
    event.dataTransfer.effectAllowed = 'move'
  }

  const acceptDrop = (event: React.DragEvent) => {
    const id = event.dataTransfer.getData(PANEL_MIME)
    if (!id || floating) return
    event.preventDefault()
    host.move(id, state.dock, definition.id)
  }

  const dragFloat = (event: React.PointerEvent) => {
    if (!floating) return
    event.preventDefault()
    const originX = event.clientX
    const originY = event.clientY
    const startX = state.x ?? 80
    const startY = state.y ?? 70
    const move = (next: PointerEvent) =>
      host.setFloatRect(definition.id, { x: Math.max(0, startX + next.clientX - originX), y: Math.max(0, startY + next.clientY - originY) })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const style = floating
    ? { left: state.x ?? 80, top: state.y ?? 70, width: state.width ?? 380, height: state.height ?? 460 }
    : // Golden ratio is the default. A dragged split stores pixels, which is a
      // basis rather than a grow ratio — mixing the two produced nonsense widths,
      // so a sized panel switches to a fixed basis (see [data-sized] in CSS).
      ({
        '--panel-weight': panelWeight(state.order, state.dock),
        '--panel-basis': state.size ? `${state.size}px` : undefined,
      } as React.CSSProperties)

  return (
    <section
      style={style as React.CSSProperties}
      data-panel-id={definition.id}
      data-sized={!floating && state.size ? "true" : undefined}
      className={`artinos-panel artinos-panel-${state.dock} artinos-panel-${definition.id} ${state.open ? 'is-open' : 'is-closed'}`}
      onDragOver={event => !floating && event.preventDefault()}
      onDrop={acceptDrop}
    >
      <div className="artinos-panel-header">
        <button
          draggable
          onDragStart={startDrag}
          className="artinos-panel-drag"
          title={definition.description ?? 'Drag to move · click to collapse · double-click to focus'}
          onClick={() => host.toggleOpen(definition.id)}
          onDoubleClick={() => host.focus(definition.id)}
          aria-expanded={state.open}
        >
          {Icon && <Icon size={12} />}
          <span>{definition.title}</span>
          <span>{state.open ? '−' : '+'}</span>
        </button>
        {floating && (
          <button className="artinos-panel-float-move" title="Move floating panel" onPointerDown={dragFloat}>
            <Move size={11} />
          </button>
        )}
        <button
          className="artinos-panel-float"
          title={floating ? 'Dock to bottom' : 'Float panel'}
          onClick={() => host.move(definition.id, floating ? 'bottom' : 'float')}
        >
          {floating ? <Minimize2 size={11} /> : <PictureInPicture2 size={11} />}
        </button>
        <button className="artinos-panel-close" title="Hide panel" onClick={() => host.toggleVisible(definition.id)}>
          <X size={12} />
        </button>
      </div>
      {state.open && (
        <>
          <div className="artinos-panel-body">{definition.content}</div>
          {definition.footer && <div className="artinos-panel-footer">{definition.footer}</div>}
        </>
      )}
      <PanelResizer id={definition.id} state={state} />
    </section>
  )
}

function PanelResizer({ id, state }: { id: string; state: PanelState }) {
  const host = usePanelHost()

  const start = (event: React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const originX = event.clientX
    const originY = event.clientY

    const move =
      state.dock === 'float'
        ? (next: PointerEvent) =>
            host.setFloatRect(id, {
              width: Math.max(280, (state.width ?? 380) + next.clientX - originX),
              height: Math.max(220, (state.height ?? 460) + next.clientY - originY),
            })
        : (next: PointerEvent) => {
            const base = state.size ?? (state.dock === 'bottom' ? 360 : 280)
            // A bottom dock lays panels out horizontally, so its grip tracks X.
            host.resize(id, base + (state.dock === 'bottom' ? next.clientX - originX : next.clientY - originY))
          }

    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return <div className={`artinos-panel-split-resizer split-${state.dock}`} onPointerDown={start} />
}

/** Drop target that appends a dragged panel to the end of a dock. */
export function DockDropZone({ dock }: { dock: 'left' | 'right' | 'bottom' }) {
  const host = usePanelHost()
  return (
    <div
      className="artinos-dock-dropzone"
      onDragOver={event => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        event.currentTarget.dataset.dragover = 'true'
      }}
      onDragLeave={event => delete event.currentTarget.dataset.dragover}
      onDrop={event => {
        const id = event.dataTransfer.getData(PANEL_MIME)
        delete event.currentTarget.dataset.dragover
        if (!id) return
        event.preventDefault()
        host.move(id, dock)
      }}
    >
      Drop panel here
    </div>
  )
}

export { PANEL_MIME }
