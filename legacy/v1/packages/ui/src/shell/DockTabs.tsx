import { useState } from 'react'
import { usePanelHost } from './panel-host'
import { MAX_PANELS_PER_DOCK } from './panel-layout'
import type { EdgeDock } from './panel-types'

/** Zone under the pointer, as a slot index. */
function zoneFor(event: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>): number {
  const rect = event.currentTarget.getBoundingClientRect()
  const t = (event.clientX - rect.left) / (rect.width || 1)
  return t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2
}

/**
 * Tab strip (reference SH.01) with positional targeting.
 *
 * Each tab is three zones wide. Where you click inside the tab decides which
 * column the panel opens in — left is the lead, right is the tail — so choosing
 * a panel and placing it are one gesture instead of two.
 *
 * The rule under each tab is the map: three segments, one per column. A filled
 * segment is where that panel currently sits; the outlined one follows the
 * pointer to show where the click would put it.
 */
export function DockTabs({ dock }: { dock: EdgeDock }) {
  const host = usePanelHost()
  const [hover, setHover] = useState<{ id: string; zone: number } | null>(null)
  const panels = host.definitions.filter(definition => host.get(definition.id)?.dock === dock)
  if (!panels.length) return null

  return (
    <div className="plate-dock-tabs" role="tablist" aria-label={`${dock} dock panels`}>
      {panels.map(panel => {
        const slot = host.slotOf(panel.id)
        const isOpen = slot >= 0
        const targeted = hover?.id === panel.id ? hover.zone : -1

        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={isOpen}
            className={isOpen ? 'is-active' : ''}
            data-slot={isOpen ? slot : undefined}
            data-target={targeted >= 0 ? targeted : undefined}
            onPointerMove={e => setHover({ id: panel.id, zone: zoneFor(e) })}
            onPointerLeave={() => setHover(h => (h?.id === panel.id ? null : h))}
            onClick={e => host.place(panel.id, dock, zoneFor(e))}
            title={`${panel.description ?? panel.title} — click left, middle or right to place it in that column`}
          >
            <span className="plate-tab-label">{panel.title}</span>
            <span className="plate-tab-slots" aria-hidden>
              {Array.from({ length: MAX_PANELS_PER_DOCK }, (_, index) => (
                <i
                  key={index}
                  data-here={isOpen && slot === index ? '' : undefined}
                  data-target={targeted === index ? '' : undefined}
                />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
