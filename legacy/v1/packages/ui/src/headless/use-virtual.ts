import { useCallback, useEffect, useRef, useState } from 'react'

export interface VirtualOptions {
  /** Total number of items. */
  count: number
  /** Fixed row height in pixels. Rows must be uniform — that is what keeps this cheap. */
  itemHeight: number
  /** Items per row. `1` for a list, `n` for a grid. */
  columns?: number
  /** Extra rows rendered above and below the viewport. */
  overscan?: number
}

export interface VirtualWindow {
  /** Attach to the scrolling element. */
  ref: (node: HTMLElement | null) => void
  /** First visible item index. */
  start: number
  /** One past the last visible item index. */
  end: number
  /** Height of the full list, for the spacer element. */
  totalHeight: number
  /** Pixel offset of `start`, applied as a transform on the rendered slice. */
  offset: number
}

/**
 * Windowed rendering for uniform-height rows. Keeps mounted DOM proportional to the
 * viewport instead of to the data, which is what stops thousand-row panels from janking.
 *
 * Scroll updates are coalesced into one rAF so a fast wheel gesture cannot queue more
 * renders than the display can show.
 */
export function useVirtual({ count, itemHeight, columns = 1, overscan = 6 }: VirtualOptions): VirtualWindow {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const frame = useRef(0)

  const measure = useCallback(
    (element: HTMLElement) => {
      const rows = Math.ceil(count / columns)
      const firstRow = Math.max(0, Math.floor(element.scrollTop / itemHeight) - overscan)
      const visibleRows = Math.ceil(element.clientHeight / itemHeight) + overscan * 2
      const lastRow = Math.min(rows, firstRow + visibleRows)
      const start = firstRow * columns
      const end = Math.min(count, lastRow * columns)
      setRange(previous => (previous.start === start && previous.end === end ? previous : { start, end }))
    },
    [count, columns, itemHeight, overscan],
  )

  useEffect(() => {
    if (!node) return
    const schedule = () => {
      if (frame.current) return
      frame.current = window.setTimeout(() => {
        frame.current = 0
        measure(node)
      })
    }
    measure(node)
    node.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', schedule)
      observer.disconnect()
      if (frame.current) window.clearTimeout(frame.current)
      frame.current = 0
    }
  }, [node, measure])

  const rows = Math.ceil(count / columns)
  return {
    ref: setNode,
    start: range.start,
    end: range.end,
    totalHeight: rows * itemHeight,
    offset: Math.floor(range.start / columns) * itemHeight,
  }
}
