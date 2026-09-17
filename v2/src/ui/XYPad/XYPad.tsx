import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import './XYPad.css'

export interface XYPadProps {
  /** [x, y], each within its range. */
  value: [number, number]
  onChange: (value: [number, number]) => void
  label: string
  xRange?: [number, number]
  yRange?: [number, number]
  /** Height in px; width follows the container. */
  height?: number
  onCommit?: (value: [number, number]) => void
  className?: string
  style?: CSSProperties
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * XYPad — drag a point across a 2D field (pan, direction, two linked
 * parameters). Arrow keys move it; Shift for fine steps. Y grows upward.
 */
export function XYPad({ value, onChange, label, xRange = [-1, 1], yRange = [-1, 1], height = 110, onCommit, className, style }: XYPadProps) {
  const pad = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const tx = clamp01((value[0] - xRange[0]) / (xRange[1] - xRange[0] || 1))
  const ty = clamp01((value[1] - yRange[0]) / (yRange[1] - yRange[0] || 1))
  const from = (u: number, v: number): [number, number] => [xRange[0] + clamp01(u) * (xRange[1] - xRange[0]), yRange[0] + clamp01(v) * (yRange[1] - yRange[0])]

  const place = (event: PointerEvent) => {
    const rect = pad.current!.getBoundingClientRect()
    const next = from((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height)
    onChange(next)
    return next
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.005 : 0.02
    let [u, v] = [tx, ty]
    if (event.key === 'ArrowLeft') u -= step
    else if (event.key === 'ArrowRight') u += step
    else if (event.key === 'ArrowUp') v += step
    else if (event.key === 'ArrowDown') v -= step
    else return
    event.preventDefault()
    const next = from(u, v)
    onChange(next)
    onCommit?.(next)
  }

  return (
    <div
      ref={pad}
      className={className ? `aui-xypad ${className}` : 'aui-xypad'}
      style={{ height, ['--x' as string]: tx, ['--y' as string]: ty, ...style }}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={`x ${value[0].toFixed(2)}, y ${value[1].toFixed(2)}`}
      onPointerDown={event => {
        if (event.button !== 0) return
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        place(event)
      }}
      onPointerMove={event => {
        if (dragging.current) place(event)
      }}
      onPointerUp={event => {
        if (!dragging.current) return
        dragging.current = false
        const placed = place(event)
        onCommit?.(placed)
      }}
      onKeyDown={onKeyDown}
    >
      <span className="aui-xypad__cross" data-axis="x" />
      <span className="aui-xypad__cross" data-axis="y" />
      <span className="aui-xypad__point" />
      <span className="aui-xypad__readout">
        {value[0].toFixed(2)} · {value[1].toFixed(2)}
      </span>
    </div>
  )
}

export default XYPad
