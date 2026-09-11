import type { Dock, EdgeDock, PanelDefinition, PanelLayout, PanelState } from './panel-types'

/**
 * Panel layout transitions as pure functions.
 *
 * Keeping this out of React is what makes the panel system easy to reason about: every
 * transition is `(layout, args) => layout`, so it can be read, tested and changed without
 * touching a component, and no transition can capture a stale state closure.
 */

const FLOAT_DEFAULTS = { width: 380, height: 460 }

function initialState(definition: PanelDefinition, index: number): PanelState {
  return {
    dock: definition.dock ?? 'bottom',
    order: definition.order ?? index,
    open: definition.open !== false,
    visible: definition.visible !== false,
    // Left undefined so the golden-ratio default applies. It is set only when a
    // split handle is dragged, which is what makes that drag an override.
    size: undefined,
    // Cascade floats so two panels opened back to back do not stack exactly.
    x: 70 + index * 12,
    y: 62 + index * 10,
    ...FLOAT_DEFAULTS,
  }
}

export function createLayout(definitions: PanelDefinition[]): PanelLayout {
  const layout: PanelLayout = Object.fromEntries(
    definitions.map((definition, index) => [definition.id, initialState(definition, index)]),
  )
  return clampDocks(layout)
}

/**
 * Enforces the three-panel ceiling per dock and renumbers what survives.
 *
 * Applied to a fresh layout and to any restored one, so a saved session from
 * before the ceiling — or a definition list that marks five panels visible —
 * cannot produce a dock of unreadable slivers.
 */
export function clampDocks(layout: PanelLayout): PanelLayout {
  let next = { ...layout }
  for (const dock of ['left', 'right', 'bottom'] as const) {
    const inDock = Object.entries(next)
      .filter(([, s]) => s.dock === dock && s.visible)
      .sort((a, b) => a[1].order - b[1].order)
    inDock.forEach(([key, s], index) => {
      next = { ...next, [key]: { ...s, visible: index < MAX_PANELS_PER_DOCK, order: index } }
    })
  }
  return next
}

/** Adds panels that appeared and drops panels that vanished, preserving saved state. */
export function reconcile(layout: PanelLayout, definitions: PanelDefinition[]): PanelLayout {
  const next: PanelLayout = {}
  let changed = false

  definitions.forEach((definition, index) => {
    const existing = layout[definition.id]
    if (existing) next[definition.id] = existing
    else {
      next[definition.id] = initialState(definition, index)
      changed = true
    }
  })

  if (!changed && Object.keys(next).length === Object.keys(layout).length) return clampDocks(layout)
  return clampDocks(next)
}

/** Re-numbers `order` for one dock so drag-to-reorder stays stable. */
function resequence(layout: PanelLayout, dock: Dock): PanelLayout {
  const ordered = Object.entries(layout)
    .filter(([, state]) => state.dock === dock)
    .sort((a, b) => a[1].order - b[1].order)
  const next = { ...layout }
  ordered.forEach(([id, state], index) => {
    next[id] = { ...state, order: index }
  })
  return next
}

/** Moves a panel to a dock, optionally inserting it before `beforeId`. */
export function move(layout: PanelLayout, id: string, dock: Dock, beforeId?: string): PanelLayout {
  const state = layout[id]
  if (!state) return layout

  if (dock === 'float') {
    return {
      ...layout,
      [id]: { ...state, dock, visible: true, x: state.x ?? 80, y: state.y ?? 70, width: state.width ?? FLOAT_DEFAULTS.width, height: state.height ?? FLOAT_DEFAULTS.height },
    }
  }

  const siblings = Object.entries(layout)
    .filter(([siblingId, sibling]) => siblingId !== id && sibling.dock === dock)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([siblingId]) => siblingId)

  const at = beforeId ? siblings.indexOf(beforeId) : -1
  siblings.splice(at < 0 ? siblings.length : at, 0, id)

  const next = { ...layout, [id]: { ...state, dock, visible: true } }
  siblings.forEach((siblingId, index) => {
    next[siblingId] = { ...next[siblingId], dock, order: index }
  })
  return next
}

export function toggleVisible(layout: PanelLayout, id: string): PanelLayout {
  const state = layout[id]
  return state ? { ...layout, [id]: { ...state, visible: !state.visible } } : layout
}

/**
 * A dock holds at most three panels.
 *
 * Beyond three the columns are too narrow to be worth reading, and the strip
 * already gives access to the rest. Opening a fourth retires the one furthest
 * from the lead position rather than refusing the request.
 */
export const MAX_PANELS_PER_DOCK = 3

/** SH.01, bottom dock — columns on the golden ratio: φ² : φ¹ : φ⁰. */
const PHI = 1.618
export const PANEL_WEIGHTS = [PHI * PHI, PHI, 1]

/**
 * SH.02, side dock — the reference divides the dock height by grow factors
 * 1.2 / 1 / .85 so the stack fills to the console line with the active panel
 * taking the most room. A column is not a row: φ² would starve the tail.
 */
export const SIDE_PANEL_WEIGHTS = [1.2, 1, 0.85]

/** Weight for a panel at `index`, for flex-grow along the dock's axis. */
export function panelWeight(index: number, dock: Dock = 'bottom'): number {
  const scale = dock === 'left' || dock === 'right' ? SIDE_PANEL_WEIGHTS : PANEL_WEIGHTS
  return scale[index] ?? scale[scale.length - 1]
}

export function show(layout: PanelLayout, id: string, dock?: Dock): PanelLayout {
  const state = layout[id]
  if (!state) return layout
  const target = dock ?? state.dock
  let next: PanelLayout = { ...layout, [id]: { ...state, visible: true, open: true, dock: target } }

  if (target !== 'float') {
    const inDock = Object.entries(next)
      .filter(([key, s]) => key !== id && s.dock === target && s.visible)
      .sort((a, b) => a[1].order - b[1].order)
    // Retire from the tail — the lead position is the one the user is reading.
    const excess = inDock.length - (MAX_PANELS_PER_DOCK - 1)
    for (let i = 0; i < excess; i++) {
      const [key, s] = inDock[inDock.length - 1 - i]
      next = { ...next, [key]: { ...s, visible: false } }
    }
    // The opened panel takes the lead.
    next = { ...next, [id]: { ...next[id], order: -1 } }
    const ordered = Object.entries(next)
      .filter(([, s]) => s.dock === target && s.visible)
      .sort((a, b) => a[1].order - b[1].order)
    ordered.forEach(([key, s], index) => {
      next = { ...next, [key]: { ...s, order: index } }
    })
  }
  return next
}

/**
 * Places a panel at a specific slot in a dock.
 *
 * The tab strip divides each tab into three zones, so a click carries a
 * destination as well as an intent: left opens the panel in the lead column,
 * right sends it to the tail. Slots beyond the ceiling clamp to the last one.
 */
export function placeAt(layout: PanelLayout, id: string, dock: EdgeDock, slot: number): PanelLayout {
  const state = layout[id]
  if (!state) return layout

  const target = Math.max(0, Math.min(slot, MAX_PANELS_PER_DOCK - 1))
  const others = Object.entries(layout)
    .filter(([key, s]) => key !== id && s.dock === dock && s.visible)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key]) => key)

  // Insert at the requested slot, then retire anything past the ceiling.
  const ordered = [...others]
  ordered.splice(Math.min(target, ordered.length), 0, id)
  const kept = ordered.slice(0, MAX_PANELS_PER_DOCK)
  const dropped = ordered.slice(MAX_PANELS_PER_DOCK)

  let next: PanelLayout = { ...layout, [id]: { ...state, dock, visible: true, open: true } }
  kept.forEach((key, index) => {
    next = { ...next, [key]: { ...next[key], dock, visible: true, order: index } }
  })
  for (const key of dropped) next = { ...next, [key]: { ...next[key], visible: false } }
  return next
}

/** Slot a panel currently occupies in its dock, or -1 when it is not open. */
export function slotOf(layout: PanelLayout, id: string): number {
  const state = layout[id]
  if (!state || !state.visible || state.dock === 'float') return -1
  return Object.entries(layout)
    .filter(([, s]) => s.dock === state.dock && s.visible)
    .sort((a, b) => a[1].order - b[1].order)
    .findIndex(([key]) => key === id)
}

export function toggleOpen(layout: PanelLayout, id: string): PanelLayout {
  const state = layout[id]
  return state ? { ...layout, [id]: { ...state, open: !state.open } } : layout
}

export function resize(layout: PanelLayout, id: string, size: number): PanelLayout {
  const state = layout[id]
  return state ? { ...layout, [id]: { ...state, size: Math.max(180, size) } } : layout
}

export function setFloatRect(layout: PanelLayout, id: string, patch: Partial<Pick<PanelState, 'x' | 'y' | 'width' | 'height'>>): PanelLayout {
  const state = layout[id]
  return state ? { ...layout, [id]: { ...state, ...patch } } : layout
}

/** Shows only `ids` in `dock`, in the order given. Everything else is hidden in place. */
export function soloInDock(layout: PanelLayout, ids: string[], dock: EdgeDock): PanelLayout {
  const next: PanelLayout = {}
  for (const [id, state] of Object.entries(layout)) {
    const wanted = ids.indexOf(id)
    next[id] = wanted < 0 ? { ...state, visible: false } : { ...state, visible: true, open: true, dock, order: wanted }
  }
  return next
}

/** Expands one panel and collapses its dock siblings — the "focus this" gesture. */
export function focus(layout: PanelLayout, id: string): PanelLayout {
  const target = layout[id]
  if (!target) return layout
  const next = { ...layout, [id]: { ...target, visible: true, open: true } }
  for (const [siblingId, sibling] of Object.entries(layout)) {
    if (siblingId !== id && sibling.dock === target.dock && sibling.visible) next[siblingId] = { ...sibling, open: false }
  }
  return next
}

/** Panels of one dock, visible only, in render order. */
export function panelsInDock(layout: PanelLayout, dock: Dock, known: Set<string>): string[] {
  return Object.entries(layout)
    .filter(([id, state]) => state.visible && state.dock === dock && known.has(id))
    .sort((a, b) => a[1].order - b[1].order)
    .map(([id]) => id)
}

export { resequence }
