import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import './Slider.css'

export interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Double-click returns here. Defaults to `min`. */
  defaultValue?: number
  disabled?: boolean
  /** `sm` is the 19px compact capsule. */
  size?: 'md' | 'sm'
  /** Fired once when a drag or keyboard edit ends — use it for undo history. */
  onCommit?: (value: number) => void
  className?: string
  style?: CSSProperties
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function decimalsFor(step: number) {
  if (step >= 1) return 0
  return Math.min(4, (String(step).split('.')[1] ?? '').length || 2)
}

function snap(value: number, min: number, max: number, step: number) {
  const snapped = Math.round((value - min) / step) * step + min
  return clamp(Number(snapped.toFixed(decimalsFor(step))), min, max)
}

/**
 * Slider — the capsule. The whole surface is the control: press anywhere to
 * place the value, then drag relative from there. The name and value ride
 * inside in two inks that swap at the seam, so both stay legible.
 *
 * Shift refines the drag 5×. Double-click resets. Arrow keys nudge 1% (Page
 * Up/Down 10%, Home/End to the ends). Enter or F2 types a value.
 */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  defaultValue,
  disabled = false,
  size = 'md',
  onCommit,
  className,
  style,
}: SliderProps) {
  const id = useId()
  const [editing, setEditing] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<{ startX: number; startValue: number; width: number; last: number; fine: boolean; anchorX: number } | null>(null)
  const span = max - min || 1
  const t = clamp((value - min) / span, 0, 1)
  const decimals = decimalsFor(step)
  const display = Number.isFinite(value) ? value.toFixed(decimals) : '—'

  const set = (next: number) => {
    const snapped = snap(next, min, max, step)
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

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || editing !== null || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    // Press places the value, then the drag is relative to it.
    const placed = set(min + clamp((event.clientX - rect.left) / rect.width, 0, 1) * span)
    gesture.current = { startX: event.clientX, startValue: placed, width: rect.width, last: placed, fine: event.shiftKey, anchorX: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    // Changing precision mid-drag re-anchors so the value does not jump.
    if (event.shiftKey !== g.fine) {
      g.fine = event.shiftKey
      g.startValue = g.last
      g.anchorX = event.clientX
    }
    const factor = g.fine ? 0.2 : 1
    const delta = ((event.clientX - g.anchorX) / g.width) * span * factor
    g.last = set(g.startValue + delta)
  }

  const endGesture = () => {
    const g = gesture.current
    if (!g) return
    gesture.current = null
    setDragging(false)
    onCommit?.(g.last)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const small = Math.max(step, span / 100)
    const large = Math.max(step, span / 10)
    let next: number | null = null
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + (event.shiftKey ? step : small)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - (event.shiftKey ? step : small)
        break
      case 'PageUp':
        next = value + large
        break
      case 'PageDown':
        next = value - large
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      case 'Enter':
      case 'F2':
        event.preventDefault()
        setEditing(display)
        return
      default:
        return
    }
    event.preventDefault()
    commit(next)
  }

  const finishEdit = (apply: boolean) => {
    if (apply && editing !== null) {
      const parsed = Number(editing.replace(',', '.'))
      if (Number.isFinite(parsed)) commit(parsed)
    }
    setEditing(null)
  }

  const text = (ink: 'on' | 'off') => (
    <span className="aui-slider__text" data-ink={ink} aria-hidden>
      <span className="aui-slider__name">{label}</span>
      <span className="aui-slider__value">
        {display}
        {unit && <i>{unit}</i>}
      </span>
    </span>
  )

  return (
    <div
      className={className ? `aui-slider ${className}` : 'aui-slider'}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      style={{ ['--t' as string]: t, ...style }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={unit ? `${display} ${unit}` : display}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={onKeyDown}
      onDoubleClick={() => {
        if (disabled || editing !== null) return
        commit(defaultValue ?? min)
      }}
    >
      <span className="aui-slider__fill" />
      <span className="aui-slider__seam" />
      {text('off')}
      {text('on')}
      {editing !== null && (
        <input
          id={id}
          className="aui-slider__input"
          autoFocus
          inputMode="decimal"
          value={editing}
          aria-label={`${label} value`}
          onChange={event => setEditing(event.target.value)}
          onPointerDown={event => event.stopPropagation()}
          onBlur={() => finishEdit(true)}
          onKeyDown={event => {
            event.stopPropagation()
            if (event.key === 'Enter') finishEdit(true)
            if (event.key === 'Escape') finishEdit(false)
          }}
          onFocus={event => event.currentTarget.select()}
        />
      )}
    </div>
  )
}

export default Slider
