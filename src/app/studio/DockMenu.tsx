import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { MetaBlockContextMenuItem, MetaBlockContextMenuRenderContext } from '../../ui/MetaBlock'
import { Icons } from './icons'
import './DockMenu.css'

type Edge = 'left' | 'right' | 'top' | 'bottom'
type Placement = 'snap' | 'dock' | 'pin' | 'autohide'

/** `snap-left`, `group-dock-right`, `autohide-left` … → what the engine's item places, and where. */
const PLACEMENT = /(?:^|-)(snap|dock|pin|autohide)-(left|right|top|bottom)$/
const placementOf = (item: MetaBlockContextMenuItem) => {
  const match = PLACEMENT.exec(item.id)
  return match ? { kind: match[1] as Placement, edge: match[2] as Edge } : null
}

/**
 * A tiny workspace, with the panel drawn where the action would put it:
 * a floating card inset from the edge (snap), a full band on the edge (dock),
 * a thin rail (pin) or a dashed rail that hides (auto-hide).
 */
function Diagram({ kind, edge }: { kind: Placement; edge: Edge }) {
  const vertical = edge === 'left' || edge === 'right'
  const far = edge === 'right' || edge === 'bottom'
  let shape: ReactNode
  if (kind === 'dock') {
    shape = vertical ? <rect x={far ? 19 : 2} y={2} width={9} height={18} rx={1.5} /> : <rect x={2} y={far ? 13 : 2} width={26} height={7} rx={1.5} />
  } else if (kind === 'snap') {
    shape = vertical ? <rect x={far ? 18.5 : 3.5} y={5} width={8} height={12} rx={1.5} /> : <rect x={8} y={far ? 12.5 : 3.5} width={14} height={6} rx={1.5} />
  } else {
    const rail = vertical ? { x: far ? 24 : 2, y: 2, width: 4, height: 18 } : { x: 2, y: far ? 16 : 2, width: 26, height: 4 }
    shape = <rect {...rail} rx={1} data-dashed={kind === 'autohide' || undefined} />
  }
  return (
    <svg className="dock-menu__diagram" viewBox="0 0 30 22" aria-hidden>
      <rect className="dock-menu__frame" x={0.5} y={0.5} width={29} height={21} rx={3.5} />
      <g className="dock-menu__shape">{shape}</g>
    </svg>
  )
}

/** Icons for the actions the engine offers, by id. */
function iconOf(item: MetaBlockContextMenuItem) {
  const id = item.id
  if (/return-home|group-home/.test(id)) return Icons.returnHome
  if (/float/.test(id)) return Icons.float
  if (/maximize/.test(id)) return item.label.startsWith('Restore') ? Icons.minimize : Icons.maximize
  if (/popout/.test(id)) return Icons.popout
  if (/close/.test(id)) return Icons.close
  return Icons.sliders
}

const PLACEMENT_ROWS: Array<{ label: string; kinds: Placement[] }> = [
  { label: 'Snap', kinds: ['snap'] },
  { label: 'Dock', kinds: ['dock'] },
  { label: 'Edge', kinds: ['pin', 'autohide'] },
]

/**
 * The dock's panel menu, drawn by the studio. The engine supplies the actions
 * (its `renderContextMenu` hook); this turns placement into small workspace
 * diagrams, actions into icon rows and attach targets into chips, so twelve
 * text rows become four compact lines.
 */
export function DockMenu({ model, close }: MetaBlockContextMenuRenderContext) {
  const root = useRef<HTMLDivElement>(null)
  const items = model.sections.flatMap(section => section.items)
  const placements = items.flatMap(item => {
    const placement = placementOf(item)
    return placement ? [{ item, ...placement }] : []
  })
  const attach = items.filter(item => /(^|-)attach-/.test(item.id))
  const danger = items.filter(item => item.danger)
  const actions = items.filter(item => !placementOf(item) && !attach.includes(item) && !item.danger)

  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>('[data-item]:not(:disabled)')?.focus()
  }, [])

  const run = (item: MetaBlockContextMenuItem) => {
    if (item.disabled) return
    item.onSelect()
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-item]:not(:disabled)') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (at + 1) % buttons.length
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (at - 1 + buttons.length) % buttons.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else if (event.key === 'Escape') close()
    else return
    event.preventDefault()
    event.stopPropagation()
    if (next >= 0) buttons[next]?.focus()
  }

  const [kind, posture] = model.subtitle.split(' · ')

  return (
    <div ref={root} className="dock-menu" role="menu" aria-label={`${model.title} panel`} onKeyDown={onKeyDown}>
      <header className="dock-menu__head">
        <b>{model.title}</b>
        {posture && <em>{posture.toLowerCase()}</em>}
        {kind && <small>{kind.toLowerCase()}</small>}
      </header>

      {placements.length > 0 && (
        <div className="dock-menu__place">
          {PLACEMENT_ROWS.map(row => {
            const tiles = placements.filter(entry => row.kinds.includes(entry.kind))
            if (!tiles.length) return null
            return (
              <div key={row.label} className="dock-menu__row">
                <span className="dock-menu__label">{row.label}</span>
                <div className="dock-menu__tiles">
                  {tiles.map(({ item, kind, edge }) => {
                    const name = `${item.label}${item.detail ? ` · ${item.detail}` : ''}`
                    return (
                      <button key={item.id} type="button" role="menuitem" data-item className="dock-menu__tile" disabled={item.disabled} aria-label={name} title={name} onClick={() => run(item)}>
                        <Diagram kind={kind} edge={edge} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {actions.length > 0 && (
        <div className="dock-menu__actions">
          {actions.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              data-item
              className="dock-menu__action"
              data-primary={item.primary || undefined}
              disabled={item.disabled}
              title={item.detail}
              onClick={() => run(item)}
            >
              <span className="dock-menu__icon">{iconOf(item)}</span>
              <span className="dock-menu__text">{item.label}</span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          ))}
        </div>
      )}

      {attach.length > 0 && (
        <div className="dock-menu__attach">
          <span className="dock-menu__label">Attach</span>
          <div className="dock-menu__chips">
            {attach.map(item => (
              <button key={item.id} type="button" role="menuitem" data-item className="dock-menu__chip" data-primary={item.primary || undefined} disabled={item.disabled} title={`${item.label}${item.detail ? ` · ${item.detail}` : ''}`} onClick={() => run(item)}>
                {item.label.replace(/^(Rejoin|Attach to|Group with) /, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {danger.map(item => (
        <button key={item.id} type="button" role="menuitem" data-item className="dock-menu__action dock-menu__danger" disabled={item.disabled} title={item.detail} onClick={() => run(item)}>
          <span className="dock-menu__icon">{Icons.close}</span>
          <span className="dock-menu__text">{item.label.replace(' MetaBlock', ' panel')}</span>
        </button>
      ))}
    </div>
  )
}
