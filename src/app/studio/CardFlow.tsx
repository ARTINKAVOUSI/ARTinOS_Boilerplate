import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Packs cards of different heights into columns, shortest column first, so a
 * wide dock is filled edge to edge and one tall card never strands the columns
 * beside it (CSS `columns` balances by height, so one 24-control card leaves
 * the rest of the row empty). Column count follows the panel width: never
 * narrower than `min`, never wider than `max`, never more columns than cards.
 *
 * Each card is measured with a ResizeObserver and placed with a transform, so
 * cards keep their identity (and their folded state) when the layout changes.
 */
export function CardFlow({ children, min = 320, max = 600, gap = 12, className }: { children: ReactNode; min?: number; max?: number; gap?: number; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLElement>())
  const [width, setWidth] = useState(0)
  const [heights, setHeights] = useState<Record<string, number>>({})

  const items = Children.toArray(children).filter(isValidElement)
  const keys = items.map((item, index) => String(item.key ?? index))

  // The width before first paint, then every change.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    setWidth(el.clientWidth)
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Card heights, re-measured whenever a card folds, filters or changes width.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(entries => {
      setHeights(prev => {
        let next = prev
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.flowKey
          if (!key) continue
          const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
          if (prev[key] === height) continue
          if (next === prev) next = { ...prev }
          next[key] = height
        }
        return next
      })
    })
    for (const key of keys) {
      const el = nodes.current.get(key)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [keys.join('\n')])

  // The first layout snaps into place; only later changes (a fold, a resize) glide.
  const settled = keys.every(key => heights[key] !== undefined)
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    if (!settled || animate) return
    const frame = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(frame)
  }, [settled, animate])

  const count = keys.length
  const fit = Math.max(1, Math.floor((width + gap) / (min + gap)))
  const floor = Math.max(1, Math.ceil((width + gap) / (max + gap)))
  const columns = width ? Math.max(floor, Math.min(count || 1, fit)) : 1
  const columnWidth = width ? (width - gap * (columns - 1)) / columns : undefined
  const tops = new Array<number>(columns).fill(0)
  const placed = items.map((item, index) => {
    const key = keys[index]
    const height = heights[key]
    let column = 0
    for (let c = 1; c < columns; c++) if (tops[c] < tops[column]) column = c
    const y = tops[column]
    // A card that rendered nothing (filtered out) takes no room.
    if (height) tops[column] += height + gap
    return { item, key, x: column * ((columnWidth ?? 0) + gap), y, ready: height !== undefined }
  })
  const total = Math.max(0, ...tops) - gap

  return (
    <div ref={root} className={`artinos-parameter-cards v2-flow ${className ?? ''}`.trim()} style={{ height: width ? Math.max(0, total) : undefined }}>
      {placed.map(({ item, key, x, y, ready }) => (
        <div
          key={key}
          data-flow-key={key}
          className="v2-flow__item"
          data-animate={animate || undefined}
          ref={el => {
            if (el) nodes.current.set(key, el)
            else nodes.current.delete(key)
          }}
          style={{ width: columnWidth, transform: `translate(${x}px, ${y}px)`, visibility: ready && width ? undefined : 'hidden' } as CSSProperties}
        >
          {item}
        </div>
      ))}
    </div>
  )
}
