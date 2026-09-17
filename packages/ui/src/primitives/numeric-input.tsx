import { useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react'

export function boundedNumber(raw: string, fallback: number, min = -Infinity, max = Infinity): number {
  if (!raw.trim()) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

function decimalsOf(step: number): number {
  return Math.min(6, (String(step).split('.')[1] ?? '').length)
}

/** Keep incomplete edits local so clearing a field never writes a spurious zero. */
export function NumericInput({
  value,
  min,
  max,
  step = 0.01,
  onChange,
  className,
  label,
  inputRef,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange(value: number): void
  className?: string
  label?: string
  inputRef?: Ref<HTMLInputElement>
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const origin = useRef(value)
  // Fixed decimals from the step, so a column of values keeps its alignment ("0.00", "1.00").
  const format = (number: number) => number.toFixed(decimalsOf(step))
  return (
    <input
      ref={inputRef}
      className={className}
      aria-label={label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? format(value)}
      onFocus={() => {
        origin.current = value
        setDraft(format(value))
      }}
      onChange={event => {
        const raw = event.target.value
        setDraft(raw)
        const next = Number(raw)
        if (raw.trim() && Number.isFinite(next) && next >= (min ?? -Infinity) && next <= (max ?? Infinity)) onChange(next)
      }}
      onBlur={event => {
        const next = boundedNumber(event.target.value, value, min, max)
        if (!Object.is(next, value)) onChange(next)
        setDraft(null)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.value = String(origin.current)
          onChange(origin.current)
          setDraft(null)
          event.currentTarget.blur()
        }
        // Shift takes ten steps at a time, as the reference field does.
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && event.shiftKey) {
          event.preventDefault()
          const direction = event.key === 'ArrowUp' ? 1 : -1
          const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number((value + direction * step * 10).toFixed(decimalsOf(step)))))
          onChange(next)
          setDraft(format(next))
        }
      }}
    />
  )
}

/**
 * NumberWell — the recessed field (reference `.field`).
 *
 * Drag across it to scrub the value — Shift for a fifth of the rate — or click
 * without moving to type an exact number. An axis letter, when given, sits at
 * the left; the value is set in the numeral face at the right.
 */
export function NumberWell({
  label,
  value,
  min,
  max,
  step = 0.01,
  axis,
  unit,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  axis?: string
  unit?: string
  onChange(value: number): void
}) {
  const [scrubbing, setScrubbing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // Travel accumulates from where the gesture began, so a slow Shift scrub whose
  // per-event change is under half a step still moves instead of rounding away.
  const gesture = useRef<{ x: number; start: number; travel: number; moved: boolean } | null>(null)
  const decimals = decimalsOf(step)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || document.activeElement === input.current) return
    // No focus and no text selection while scrubbing; a click still types (see end).
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { x: event.clientX, start: value, travel: 0, moved: false }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    if (!active) return
    const dx = event.clientX - active.x
    if (!active.moved && Math.abs(dx) < 3) return
    if (!active.moved) {
      active.moved = true
      setScrubbing(true)
    }
    active.x = event.clientX
    active.travel += dx * step * (event.shiftKey ? 0.2 : 1)
    const snapped = Math.round((active.start + active.travel) / step) * step
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(snapped.toFixed(decimals))))
    if (!Object.is(next, value)) onChange(next)
  }

  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = gesture.current
    gesture.current = null
    if (!active) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (active.moved) setScrubbing(false)
    else {
      input.current?.focus()
      input.current?.select()
    }
  }

  return (
    <div
      className="artinos-number-field"
      data-scrubbing={scrubbing || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {axis && <span className="artinos-number-axis">{axis}</span>}
      <NumericInput inputRef={input} className="artinos-number" label={label} value={value} min={min} max={max} step={step} onChange={onChange} />
      {unit && <em className="artinos-number-unit">{unit}</em>}
    </div>
  )
}
