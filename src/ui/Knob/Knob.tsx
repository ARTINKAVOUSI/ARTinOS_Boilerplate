import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import './Knob.css'

export interface KnobProps {
  value: number
  onChange: (value: number) => void
  label: string
  min?: number
  max?: number
  step?: number
  /** Double-click returns here. */
  defaultValue?: number
  size?: number
  /** Show the label and value under the knob. */
  showLabel?: boolean
  onCommit?: (value: number) => void
  className?: string
}

const SWEEP = 270
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const decimalsFor = (step: number) => (step >= 1 ? 0 : Math.min(4, (String(step).split('.')[1] ?? '').length || 2))

/**
 * Knob — a rotary control. Drag up/down (Shift for fine), scroll, or use the
 * arrow keys. Double-click resets.
 */
export function Knob({ value, onChange, label, min = 0, max = 1, step = 0.01, defaultValue, size = 40, showLabel = true, onCommit, className }: KnobProps) {
  const span = max - min || 1
  const t = clamp((value - min) / span, 0, 1)
  const drag = useRef<{ y: number; start: number; last: number } | null>(null)
  const decimals = decimalsFor(step)

  const set = (next: number) => {
    const snapped = clamp(Number((Math.round((next - min) / step) * step + min).toFixed(decimals)), min, max)
    if (snapped !== value) onChange(snapped)
    return snapped
  }

  // Apply first, then report. Never write onCommit?.(set(x)): optional chaining
  // skips evaluating the argument when onCommit is absent, so set() would not run.
  const commit = (next: number) => {
    const applied = set(next)
    onCommit?.(applied)
    return applied
  }

  const r = 15
  const arc = (from: number, to: number) => {
    const a0 = ((from - 90 - SWEEP / 2) * Math.PI) / 180
    const a1 = ((to - 90 - SWEEP / 2) * Math.PI) / 180
    const large = to - from > 180 ? 1 : 0
    return `M${20 + r * Math.cos(a0)} ${20 + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${20 + r * Math.cos(a1)} ${20 + r * Math.sin(a1)}`
  }
  const angle = t * SWEEP - SWEEP / 2

  return (
    <div className={className ? `aui-knob ${className}` : 'aui-knob'} style={{ width: size }}>
      <div
        className="aui-knob__dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{ width: size, height: size }}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          if (event.button !== 0) return
          drag.current = { y: event.clientY, start: value, last: value }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => {
          const d = drag.current
          if (!d) return
          d.last = set(d.start + ((d.y - event.clientY) / 150) * span * (event.shiftKey ? 0.2 : 1))
        }}
        onPointerUp={() => {
          const d = drag.current
          drag.current = null
          if (d && d.last !== d.start) onCommit?.(d.last)
        }}
        onWheel={event => commit(value - Math.sign(event.deltaY) * Math.max(step, span / 100))}
        onDoubleClick={() => commit(defaultValue ?? min)}
        onKeyDown={(event: KeyboardEvent) => {
          const d = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0
          if (!d) return
          event.preventDefault()
          commit(value + d * (event.shiftKey ? step : Math.max(step, span / 100)))
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden>
          <path className="aui-knob__track" d={arc(0, SWEEP)} />
          {t > 0.002 && <path className="aui-knob__value" d={arc(0, t * SWEEP)} />}
          <circle className="aui-knob__cap" cx="20" cy="20" r="10.5" />
          <line className="aui-knob__pointer" x1="20" y1="20" x2="20" y2="12.5" transform={`rotate(${angle} 20 20)`} />
        </svg>
      </div>
      {showLabel && (
        <div className="aui-knob__text">
          <span>{label}</span>
          <b>{value.toFixed(decimals)}</b>
        </div>
      )}
    </div>
  )
}

export default Knob
