import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Below this, the dock strip is already full of tabs, search and the HUD. */
const HOIST_WIDTH = 900

/** The panel currently being rendered, so its bar can find its own dock slot. */
export const PanelIdContext = createContext<string | null>(null)

/** Rendered by the dock chrome: where the active panel puts its toolbar. */
export function PanelBarSlot({ panelId }: { panelId: string | null }) {
  return <div className="plate-panel-slot" data-panel-slot={panelId ?? undefined} data-no-drag />
}

/**
 * A panel's toolbar. It moves into the dock's own tab bar when the panel is
 * docked, so a handful of small controls never costs a full row of the panel.
 * A floating panel has no slot, so the bar stays in the body.
 */
export function PanelBar({ className, children }: { className?: string; children: ReactNode }) {
  const panelId = useContext(PanelIdContext)
  const [host, setHost] = useState<HTMLElement | null>(null)

  // A narrow dock — a side column, or a small floating window — has no room in
  // its strip, so the bar stays in the body there.
  useLayoutEffect(() => {
    const slot = panelId ? document.querySelector<HTMLElement>(`[data-panel-slot="${panelId}"]`) : null
    const strip = slot?.parentElement
    if (!slot || !strip) {
      setHost(null)
      return
    }
    const measure = () => setHost(strip.clientWidth >= HOIST_WIDTH ? slot : null)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [panelId])

  const bar = <div className={`v2-panel-bar ${className ?? ''}`.trim()}>{children}</div>
  return host ? createPortal(bar, host) : bar
}
