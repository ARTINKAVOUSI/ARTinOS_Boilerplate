import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'

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
 * Pan with a drag on the background, scroll to move, ctrl/⌘-scroll to zoom
 * around the cursor. Returns the transform to apply to the world layer and the
 * conversion from a pointer event to graph coordinates.
 */
export function usePanZoom(initial = DEFAULT_VIEW) {
  const surface = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(initial)
  const pan = useRef<{ pointerId: number; from: Point; origin: Point } | null>(null)

  const toGraph = useCallback(
    (event: { clientX: number; clientY: number }): Point => {
      const box = surface.current?.getBoundingClientRect()
      return { x: (event.clientX - (box?.left ?? 0)) / view.scale - view.x, y: (event.clientY - (box?.top ?? 0)) / view.scale - view.y }
    },
    [view],
  )

  const startPan = (event: ReactPointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pan.current = { pointerId: event.pointerId, from: { x: view.x, y: view.y }, origin: { x: event.clientX, y: event.clientY } }
  }

  const movePan = (event: ReactPointerEvent) => {
    const current = pan.current
    if (!current || current.pointerId !== event.pointerId) return false
    setView(previous => ({ ...previous, x: current.from.x + (event.clientX - current.origin.x) / previous.scale, y: current.from.y + (event.clientY - current.origin.y) / previous.scale }))
    return true
  }

  const endPan = (event: ReactPointerEvent) => {
    if (pan.current?.pointerId === event.pointerId) pan.current = null
  }

  const onWheel = (event: ReactWheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) {
      setView(current => ({ ...current, x: current.x - event.deltaX / current.scale, y: current.y - event.deltaY / current.scale }))
      return
    }
    const box = surface.current?.getBoundingClientRect()
    const local = { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
    setView(current => {
      const scale = Math.max(0.3, Math.min(2, current.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
      // Keep the point under the cursor still while zooming.
      return { scale, x: local.x / scale - (local.x / current.scale - current.x), y: local.y / scale - (local.y / current.scale - current.y) }
    })
  }

  const transform = `scale(${view.scale}) translate(${view.x}px, ${view.y}px)`
  return { surface, view, setView, toGraph, startPan, movePan, endPan, onWheel, transform, reset: () => setView(initial) }
}
