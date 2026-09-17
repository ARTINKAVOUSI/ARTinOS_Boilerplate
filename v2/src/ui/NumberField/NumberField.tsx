import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import './NumberField.css'

export interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  /** Accessible name. */
  label: string
  /** Short prefix drawn inside the field (X, Y, Z…). Dragging it scrubs the value. */
  prefix?: string
  /** Prefix colour, e.g. axis colours. */
  prefixColor?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  onCommit?: (value: number) => void
  className?: string
  style?: CSSProperties
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const decimalsFor = (step: number) => (step >= 1 ? 0 : Math.min(4, (String(step).split('.')[1] ?? '').length || 2))

/**
 * NumberField — a compact numeric input. Type a number, use the arrow keys
 * (Shift ×10), or drag the prefix horizontally to scrub (Shift ×10, Alt ×0.1).
 */
export function NumberField({
  value,
  onChange,
  label,
  prefix,
  prefixColor,
  min = -Infinity,
  max = Infinity,
  step = 0.01,
  unit,
  disabled = false,
  onCommit,
  className,
  style,
}: NumberFieldProps) {
  const decimals = decimalsFor(step)
  const format = (v: number) => (Number.isFinite(v) ? v.toFixed(decimals) : '')
  const [draft, setDraft] = useState(format(value))
  const [focused, setFocused] = useState(false)
  const scrub = useRef<{ x: number; start: number; last: number } | null>(null)

  useEffect(() => {
    if (!focused) setDraft(format(value))
  }, [value, focused, decimals])

  const set = (next: number) => {
    const snapped = clamp(Number((Math.round(next / step) * step).toFixed(decimals)), min, max)
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

  const commitDraft = () => {
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() !== '' && Number.isFinite(parsed)) commit(parsed)
    else setDraft(format(value))
  }

  const onScrubDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled || event.button !== 0) return
    event.preventDefault()
    scrub.current = { x: event.clientX, start: value, last: value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onScrubMove = (event: PointerEvent<HTMLSpanElement>) => {
    const s = scrub.current
    if (!s) return
    const pixels = event.clientX - s.x
    const perPixel = step * (event.shiftKey ? 10 : event.altKey ? 0.1 : 1)
    s.last = set(s.start + pixels * perPixel)
  }
  const onScrubUp = () => {
    const s = scrub.current
    scrub.current = null
    if (s && s.last !== s.start) onCommit?.(s.last)
  }

  return (
    <span className={className ? `aui-number ${className}` : 'aui-number'} data-disabled={disabled || undefined} style={style}>
      <span
        className="aui-number__handle"
        style={prefixColor ? { color: prefixColor } : undefined}
        onPointerDown={onScrubDown}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubUp}
        onPointerCancel={onScrubUp}
        aria-hidden
      >
        {prefix}
      </span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={draft}
        onFocus={event => {
          setFocused(true)
          event.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          commitDraft()
        }}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commitDraft()
            event.currentTarget.select()
          } else if (event.key === 'Escape') {
            setDraft(format(value))
            event.currentTarget.blur()
          } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const next = set(value + (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1))
            setDraft(format(next))
            onCommit?.(next)
          }
        }}
      />
      {unit && <span className="aui-number__unit">{unit}</span>}
    </span>
  )
}

export default NumberField
