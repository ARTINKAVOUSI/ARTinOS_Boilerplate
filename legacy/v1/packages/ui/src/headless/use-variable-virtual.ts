import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface VariableVirtualOptions {
  count: number
  getItemSize(index: number): number
  overscan?: number
}

export interface VariableVirtualWindow {
  ref(node: HTMLElement | null): void
  start: number
  end: number
  offset: number
  totalHeight: number
  sizes: number[]
}

export function useVariableVirtual({ count, getItemSize, overscan = 4 }: VariableVirtualOptions): VariableVirtualWindow {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [range, setRange] = useState({ start: 0, end: 0 })
  const frame = useRef(0)
  const sizes = useMemo(() => Array.from({ length: count }, (_, index) => Math.max(1, getItemSize(index))), [count, getItemSize])
  const offsets = useMemo(() => {
    const values = [0]
    for (const size of sizes) values.push(values.at(-1) as number + size)
    return values
  }, [sizes])
  const locate = useCallback((position: number) => {
    let low = 0, high = count
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (offsets[middle + 1] <= position) low = middle + 1
      else high = middle
    }
    return low
  }, [count, offsets])
  const measure = useCallback((element: HTMLElement) => {
    const start = Math.max(0, locate(element.scrollTop) - overscan)
    const end = Math.min(count, locate(element.scrollTop + element.clientHeight) + overscan + 1)
    setRange(previous => previous.start === start && previous.end === end ? previous : { start, end })
  }, [count, locate, overscan])
  useEffect(() => {
    if (!node) return
    const schedule = () => {
      if (frame.current) return
      frame.current = window.setTimeout(() => { frame.current = 0; measure(node) })
    }
    measure(node)
    node.addEventListener('scroll', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', schedule)
      observer.disconnect()
      if (frame.current) window.clearTimeout(frame.current)
    }
  }, [measure, node])
  return { ref: setNode, start: range.start, end: range.end, offset: offsets[range.start] ?? 0, totalHeight: offsets.at(-1) ?? 0, sizes }
}
