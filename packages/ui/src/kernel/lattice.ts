/**
 * Adaptive lattice — the spatial substrate (PRD §22–25).
 *
 * The workspace is a living grid, not a bag of rectangles. Components occupy,
 * span and subdivide cells; the grid is usually invisible but always the
 * grammar. Pure maths, so layout can be reasoned about without a DOM.
 */

export interface LatticeScale {
  /** Base cell edge in px. */
  unit: number
  /** Gutter between cells. */
  gap: number
  /** Subdivisions of a unit that a component may still align to. */
  subdivision: number
}

/** Semantic scales, replacing the earlier hard-coded large/half/quarter units. */
export const LATTICE: Record<'dense' | 'standard' | 'comfortable' | 'spatial', LatticeScale> = {
  dense: { unit: 24, gap: 4, subdivision: 4 },
  standard: { unit: 32, gap: 6, subdivision: 4 },
  comfortable: { unit: 44, gap: 12, subdivision: 2 },
  spatial: { unit: 64, gap: 16, subdivision: 2 },
}

export type Cells = readonly [columns: number, rows: number]
export interface LatticeContext {
  context?: 'inspector' | 'toolbar' | 'canvasOverlay' | 'node' | 'workspace' | (string & {})
  modality?: 'pointer' | 'touch' | 'pen' | 'keyboard' | 'spatial' | (string & {})
  zoom?: number
  importance?: 'primary' | 'secondary' | 'advanced'
  direction?: 'ltr' | 'rtl'
}

/** How a component wants to occupy the lattice (PRD §24). */
export interface LayoutMetadata {
  minCells: Cells
  idealCells: Cells
  maxCells?: Cells
  expandable?: boolean
  compressible?: boolean
  /** 0..1 — who keeps their space when the container cannot satisfy everyone. */
  priority?: number
  /** Presentation to fall back to when the row is compressed. */
  compactPresentation?: string
  contexts?: string[]
  modalities?: string[]
  zoomRange?: readonly [number, number]
  importance?: LatticeContext['importance']
  presentations?: Partial<Record<'large' | 'medium' | 'compact' | 'micro', string>>
}

export function defineLayout(meta: LayoutMetadata): LayoutMetadata {
  return meta
}

/** px needed for `n` cells at a scale, gutters included. */
export function cellSpan(n: number, scale: LatticeScale): number {
  return n <= 0 ? 0 : n * scale.unit + (n - 1) * scale.gap
}

/** Largest whole cell count that fits in `width`. */
export function cellsForWidth(width: number, scale: LatticeScale): number {
  return Math.max(0, Math.floor((width + scale.gap) / (scale.unit + scale.gap)))
}

/** Snaps a pixel value onto the lattice, including its subdivisions. */
export function snapToLattice(px: number, scale: LatticeScale): number {
  const step = scale.unit / scale.subdivision
  return Math.round(px / step) * step
}

export interface AllocationRequest {
  id: string
  layout: LayoutMetadata
}

export interface Allocation {
  id: string
  cells: number
  /** True when the item had to drop below its ideal width. */
  compressed: boolean
  /** True when the item could not fit at all and should be hidden or folded. */
  dropped: boolean
}

/**
 * Distributes columns across a row.
 *
 * Everyone gets their minimum first; whatever is left is shared by priority up
 * to each item's ideal, then to its maximum. Items that cannot make their
 * minimum are dropped, highest-priority last — which is what lets a toolbar
 * shed controls gracefully instead of overflowing.
 */
export function allocate(
  requests: readonly AllocationRequest[],
  available: number,
  scale: LatticeScale,
): Allocation[] {
  const columns = cellsForWidth(available, scale)
  const ordered = [...requests].sort((a, b) => (b.layout.priority ?? 0.5) - (a.layout.priority ?? 0.5))

  const result = new Map<string, Allocation>()
  let remaining = columns

  // 1. minimums, in priority order; anything that cannot fit is dropped
  for (const request of ordered) {
    const min = request.layout.minCells[0]
    if (min <= remaining) {
      result.set(request.id, { id: request.id, cells: min, compressed: true, dropped: false })
      remaining -= min
    } else {
      result.set(request.id, { id: request.id, cells: 0, compressed: true, dropped: true })
    }
  }

  // 2. grow toward ideal
  for (const request of ordered) {
    const allocation = result.get(request.id)!
    if (allocation.dropped) continue
    const want = request.layout.idealCells[0] - allocation.cells
    const give = Math.max(0, Math.min(want, remaining))
    allocation.cells += give
    remaining -= give
    if (allocation.cells >= request.layout.idealCells[0]) allocation.compressed = false
  }

  // 3. spend anything left on items that said they expand
  for (const request of ordered) {
    if (!remaining) break
    const allocation = result.get(request.id)!
    if (allocation.dropped || request.layout.expandable === false) continue
    const ceiling = request.layout.maxCells?.[0] ?? Infinity
    const give = Math.max(0, Math.min(ceiling - allocation.cells, remaining))
    allocation.cells += give
    remaining -= give
  }

  // preserve the caller's order; priority only decided who won
  return requests.map(r => result.get(r.id)!)
}

/**
 * Presentation ladder (PRD §25). A control does not merely restyle as it
 * narrows — below each threshold it may become a different presentation.
 */
export type Presentation = 'large' | 'medium' | 'compact' | 'micro'

export function presentationForCells(cells: number): Presentation {
  if (cells >= 8) return 'large'
  if (cells >= 5) return 'medium'
  if (cells >= 3) return 'compact'
  return 'micro'
}

export function presentationForWidth(width: number, scale: LatticeScale = LATTICE.standard): Presentation {
  return presentationForCells(cellsForWidth(width, scale))
}

export function layoutMatchesContext(layout: LayoutMetadata, context: LatticeContext = {}): boolean {
  if (layout.contexts?.length && context.context && !layout.contexts.includes(context.context)) return false
  if (layout.modalities?.length && context.modality && !layout.modalities.includes(context.modality)) return false
  if (layout.importance && context.importance && layout.importance !== context.importance) return false
  const zoom = context.zoom ?? 1
  if (layout.zoomRange && (zoom < layout.zoomRange[0] || zoom > layout.zoomRange[1])) return false
  return true
}

export function adaptivePresentation(
  layout: LayoutMetadata,
  width: number,
  scale: LatticeScale = LATTICE.standard,
  context: LatticeContext = {},
): string | undefined {
  if (!layoutMatchesContext(layout, context)) return undefined
  const density = presentationForWidth(width / Math.max(0.01, context.zoom ?? 1), scale)
  return layout.presentations?.[density] ?? (density === 'compact' || density === 'micro' ? layout.compactPresentation : undefined) ?? density
}
