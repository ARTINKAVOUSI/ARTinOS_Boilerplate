/**
 * React bindings for the lattice.
 *
 * Adaptive behaviour goes beyond CSS breakpoints: it measures the *container*,
 * not the viewport, and lets a component change presentation rather than only
 * restyle (PRD §6 G6, §25).
 */

import { useEffect, useRef, useState } from 'react'
import {
  LATTICE,
  cellsForWidth,
  presentationForCells,
  type LatticeScale,
  type Presentation,
} from '../kernel'

export interface LatticeView {
  ref: React.RefObject<HTMLDivElement | null>
  width: number
  cells: number
  presentation: Presentation
  /** Set on the element so CSS can respond to the same decision. */
  attributes: { 'data-presentation': Presentation; 'data-cells': number }
}

/**
 * Measures the container and reports its lattice allocation.
 *
 * ResizeObserver rather than a media query, because a panel's width is set by
 * the dock, not the window — the same control can be `large` in one dock and
 * `micro` in another at the same viewport size.
 */
export function useLattice(scale: LatticeScale = LATTICE.standard): LatticeView {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const next = entry.contentRect.width
        // Only react on a change that could cross a cell boundary; sub-pixel
        // reflow must not re-render a whole inspector.
        setWidth(previous => (Math.abs(previous - next) >= 1 ? next : previous))
      }
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])

  const cells = cellsForWidth(width, scale)
  const presentation = presentationForCells(cells)
  return {
    ref,
    width,
    cells,
    presentation,
    attributes: { 'data-presentation': presentation, 'data-cells': cells },
  }
}
