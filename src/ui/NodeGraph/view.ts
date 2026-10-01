import { useCallback, useEffect, useRef, useState } from 'react'

export interface Point {
  x: number
  y: number
}

/** The curve a wire follows between two anchors. */
export const wirePath = (a: Point, b: Point) => {
  const bend = Math.max(30, Math.min(140, Math.abs(b.x - a.x) * 0.55))
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`
}

export const DEFAULT_VIEW = { x: 40, y: 20, scale: 1 }

/**
 * Scroll to move, ctrl/⌘-scroll to zoom around the cursor (attach `surface` to
 * the element that takes the wheel; drag-panning is the caller's, via
 * `setView`). Returns the transform to apply to the world layer and the
 * conversion from a pointer event to graph coordinates.
 */
export function usePanZoom(initial = DEFAULT_VIEW) {
  const surface = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(initial)

  const toGraph = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const box = surface.current?.getBoundingClientRect()
      return { x: (event.clientX - (box?.left ?? 0)) / view.scale - view.x, y: (event.clientY - (box?.top ?? 0)) / view.scale - view.y }
    },
    [view],
  )

  // A native, non-passive listener: React's wheel listeners are passive, so they
  // cannot stop ctrl/⌘-scroll zooming the page or a plain scroll moving the panel.
  useEffect(() => {
    const element = surface.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (!event.ctrlKey && !event.metaKey) {
        setView(current => ({ ...current, x: current.x - event.deltaX / current.scale, y: current.y - event.deltaY / current.scale }))
        return
      }
      const box = element.getBoundingClientRect()
      const local = { x: event.clientX - box.left, y: event.clientY - box.top }
      setView(current => {
        const scale = Math.max(0.3, Math.min(2, current.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
        // Keep the point under the cursor still while zooming.
        return { scale, x: local.x / scale - (local.x / current.scale - current.x), y: local.y / scale - (local.y / current.scale - current.y) }
      })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [])

  const transform = `scale(${view.scale}) translate(${view.x}px, ${view.y}px)`
  return { surface, view, setView, toGraph, transform }
}
