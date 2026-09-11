import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '../headless'
import * as layoutOps from './panel-layout'
import type { Dock, EdgeDock, PanelDefinition, PanelLayout, PanelState } from './panel-types'

export interface PanelHost {
  /** Live layout, keyed by panel id. */
  layout: PanelLayout
  /** The panels currently registered with the host. */
  definitions: PanelDefinition[]
  get(id: string): PanelState | undefined
  move(id: string, dock: Dock, beforeId?: string): void
  toggleVisible(id: string): void
  toggleOpen(id: string): void
  show(id: string, dock?: Dock): void
  /** Expands one panel and collapses its dock siblings. */
  focus(id: string): void
  resize(id: string, size: number): void
  setFloatRect(id: string, patch: Partial<Pick<PanelState, 'x' | 'y' | 'width' | 'height'>>): void
  /** Shows only these panels, in this dock, in this order. */
  solo(ids: string[], dock?: EdgeDock): void
  /** Opens a panel at a specific slot in a dock. */
  place(id: string, dock: EdgeDock, slot: number): void
  /** Slot the panel occupies, or -1 when it is not open. */
  slotOf(id: string): number
  reset(): void
}

const PanelHostContext = createContext<PanelHost | null>(null)

export function usePanelHost(): PanelHost {
  const host = useContext(PanelHostContext)
  if (!host) throw new Error('usePanelHost requires <PanelHostProvider>')
  return host
}

/**
 * Owns panel layout state and persistence. All transitions delegate to the pure helpers
 * in `panel-layout.ts`, so this component stays a thin wiring layer.
 */
export function PanelHostProvider({
  definitions,
  persistKey,
  children,
}: {
  definitions: PanelDefinition[]
  persistKey: string
  children: ReactNode
}) {
  const [layout, , setLayout] = usePersistentState<PanelLayout>(persistKey, layoutOps.createLayout(definitions))

  // Panels can be added or removed between releases; keep saved state and drop the rest.
  const signature = definitions.map(definition => definition.id).join('|')
  useEffect(() => {
    setLayout(current => layoutOps.reconcile(current, definitions))
    // `signature` is the meaningful dependency; `definitions` is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const host = useMemo<PanelHost>(() => {
    const apply = (transition: (current: PanelLayout) => PanelLayout) => setLayout(current => transition(current))
    return {
      layout,
      definitions,
      get: id => layout[id],
      move: (id, dock, beforeId) => apply(current => layoutOps.move(current, id, dock, beforeId)),
      toggleVisible: id => apply(current => layoutOps.toggleVisible(current, id)),
      toggleOpen: id => apply(current => layoutOps.toggleOpen(current, id)),
      show: (id, dock) => apply(current => layoutOps.show(current, id, dock)),
      focus: id => apply(current => layoutOps.focus(current, id)),
      resize: (id, size) => apply(current => layoutOps.resize(current, id, size)),
      setFloatRect: (id, patch) => apply(current => layoutOps.setFloatRect(current, id, patch)),
      solo: (ids, dock = 'bottom') => apply(current => layoutOps.soloInDock(current, ids, dock)),
      place: (id, dock, slot) => apply(current => layoutOps.placeAt(current, id, dock, slot)),
      slotOf: id => layoutOps.slotOf(layout, id),
      reset: () => setLayout(layoutOps.createLayout(definitions)),
    }
  }, [layout, definitions, setLayout])

  return <PanelHostContext.Provider value={host}>{children}</PanelHostContext.Provider>
}
