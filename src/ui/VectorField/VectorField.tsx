import { useEffect, useRef, useState, type PointerEvent } from 'react'
import './VectorField.css'

export type Vector = readonly number[]

export interface VectorFieldProps<V extends Vector> {
  value: V
  onChange: (value: V) => void
  /** Accessible name of the whole vector. */
  label: string
  /** Component names; defaults to X Y Z W. */
  axes?: readonly string[]
  step?: number
  min?: number
  max?: number
  onCommit?: (value: V) => void
  className?: string
}

const AXIS_COLORS = ['#ff7a85', '#8fe38a', '#79b8ff', '#d9c7ff']
const decimalsFor = (step: number) => (step >= 1 ? 0 : Math.min(4, (String(step).split('.')[1] ?? '').length || 2))

function Cell({ axis, color, value, step, min, max, label, onChange, onCommit }: {
  axis: string
  color: string
  value: number
  step: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
  onCommit: (value: number) => void
}) {
  const decimals = decimalsFor(step)
  const format = (v: number) => v.toFixed(decimals)
  const [draft, setDraft] = useState(format(value))
  const [focused, setFocused] = useState(false)
  const scrub = useRef<{ x: number; start: number; last: number } | null>(null)

  useEffect(() => {
    if (!focused) setDraft(format(value))
  }, [value, focused, decimals])

  const clean = (v: number) => Math.min(max, Math.max(min, Number((Math.round(v / step) * step).toFixed(decimals))))

  const onDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    scrub.current = { x: event.clientX, start: value, last: value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onMove = (event: PointerEvent<HTMLSpanElement>) => {
    const s = scrub.current
    if (!s) return
    s.last = clean(s.start + (event.clientX - s.x) * step * (event.shiftKey ? 10 : 1))
    onChange(s.last)
  }
  const onUp = () => {
    const s = scrub.current
    scrub.current = null
    if (s && s.last !== s.start) onCommit(s.last)
  }
  const commit = () => {
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() !== '' && Number.isFinite(parsed)) {
      const next = clean(parsed)
      onChange(next)
      onCommit(next)
    } else setDraft(format(value))
  }

  return (
    <span className="aui-vector__cell">
      <span className="aui-vector__axis" style={{ color }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden>
        {axis}
      </span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${label} ${axis}`}
        value={draft}
        onFocus={event => {
          setFocused(true)
          event.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          commit()
        }}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') commit()
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const next = clean(value + (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1))
            onChange(next)
            onCommit(next)
          }
        }}
      />
    </span>
  )
}

/** VectorField — 2, 3 or 4 numeric components side by side, each scrubbable by its axis letter. */
export function VectorField<V extends Vector>({ value, onChange, label, axes = ['X', 'Y', 'Z', 'W'], step = 0.01, min = -Infinity, max = Infinity, onCommit, className }: VectorFieldProps<V>) {
  const latest = useRef(value)
  latest.current = value
  const update = (index: number, component: number) => {
    const next = latest.current.map((v, i) => (i === index ? component : v)) as unknown as V
    latest.current = next
    onChange(next)
    return next
  }
  return (
    <span role="group" aria-label={label} className={className ? `aui-vector ${className}` : 'aui-vector'} style={{ ['--count' as string]: value.length }}>
      {value.map((component, index) => (
        <Cell
          key={index}
          axis={axes[index] ?? String(index)}
          color={AXIS_COLORS[index % AXIS_COLORS.length]}
          value={component}
          step={step}
          min={min}
          max={max}
          label={label}
          onChange={v => update(index, v)}
          onCommit={() => onCommit?.(latest.current)}
        />
      ))}
    </span>
  )
}

export default VectorField
