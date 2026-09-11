import { useEffect, useRef, useState } from 'react'
import { angularGeometry, DIAL_TRAVEL, linearGeometry, normalize } from '../kernel'
import { useControl, type ControlScheduler } from '../react/use-control'
import { controls } from './control-registry'
import { NumericInput } from './numeric-input'

export interface SliderProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  readOnly?: boolean
  /** Values that magnetise the drag. Rendered as detent marks. */
  detents?: readonly number[]
  /** Shown after the label — names the source when a parameter is externally driven. */
  binding?: string
  /** Signal state. `bound` is set automatically when `binding` is present. */
  status?: 'bound' | 'warn' | 'fault'
  /** Opened when a gesture starts; use it to open a history transaction. */
  onGestureStart?(): void
  onGestureEnd?(): void
  scheduler?: ControlScheduler
  physicsProfile?: 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial'
  onChange(value: number): void
}

function decimalsFor(step: number): number {
  if (step >= 1) return 0
  return Math.min(3, (String(step).split('.')[1] ?? '').length || 2)
}

/**
 * Scrub cell — the flagship control (reference PL.03).
 *
 * The row *is* the drag surface: the fill is the value and the hairline is its
 * exact position. Every mechanic — precision, detents, constrain, nudge, reset,
 * cancel — comes from the kernel's `ControlBehavior`, so this file renders
 * anatomy and nothing else.
 *
 * Anatomy: Root · Fill · Tick · Label · Binding · Value · Unit.
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  disabled = false,
  readOnly = false,
  detents,
  binding,
  status,
  onGestureStart,
  onGestureEnd,
  scheduler,
  physicsProfile,
  onChange,
}: SliderProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const display = value.toFixed(decimalsFor(step))

  const control = useControl({
    value,
    min,
    max,
    step,
    detents,
    defaultValue: min,
    disabled: disabled || editing !== null,
    readOnly,
    onChange,
    onGestureStart,
    onGestureEnd,
    scheduler,
    physicsProfile,
  })

  control.setFormatter(v => v.toFixed(decimalsFor(step)))

  useEffect(() => {
    if (editing !== null) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    if (editing === null) return
    const parsed = parseFloat(editing)
    if (!Number.isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
    setEditing(null)
  }

  const geometry = linearGeometry({ length: 100, value, min, max, detents })
  // Fill and tick are driven by --control-t, which useControl writes straight to
  // the element during a drag. React only seeds it.
  const seed = geometry.normalized
  // The value tracks the pointer exactly during a drag; easing it would lag the cursor.
  const glide = control.isDragging ? 'none' : `width var(--dur-value) var(--ease-std)`

  const state = status && !control.isDragging ? status : undefined

  return (
    <div
      ref={control.ref}
      className={`artinos-scrub-cell ${control.isDragging ? 'is-scrubbing' : ''} ${disabled ? 'is-disabled' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={unit ? `${display} ${unit}` : display}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      {...control.attributes}
      data-state={state ?? control.attributes['data-state']}
      {...control.handlers}
      onDoubleClick={() => setEditing(display)}
      style={{ ['--control-t' as string]: String(seed) }}
    >
      <i aria-hidden style={{ transition: glide }} />
      <b aria-hidden style={{ transition: control.isDragging ? 'none' : `left var(--dur-value) var(--ease-std)` }} />
      {geometry.detents.map((position, index) => (
        <u
          key={index}
          aria-hidden
          className="artinos-scrub-detent"
          style={{ left: `${position}%` }}
        />
      ))}
      <span>
        {label}
        {binding && <em>{binding}</em>}
      </span>
      {editing !== null ? (
        <input
          ref={inputRef}
          value={editing}
          onChange={event => setEditing(event.target.value)}
          onBlur={commit}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            event.stopPropagation()
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setEditing(null)
          }}
        />
      ) : (
        <output>
          <span ref={control.liveRef as React.RefObject<HTMLSpanElement>}>{display}</span>
          {unit && <em>{unit}</em>}
        </output>
      )}
    </div>
  )
}

Slider.meta = controls.require('slider')

export function NumberField({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange(value: number): void
}) {
  return (
    <label className="artinos-control">
      <span>{label}</span>
      <NumericInput
        className="artinos-number artinos-number-wide"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
      />
      {unit && <em>{unit}</em>}
    </label>
  )
}

export function RangeSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  onChange,
}: {
  label: string
  value: [number, number]
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange(value: [number, number]): void
}) {
  const set = (index: 0 | 1, next: number) => {
    const bounds: [number, number] = [...value]
    bounds[index] = next
    // Pushing one handle past the other drags the other with it rather than inverting.
    if (bounds[0] > bounds[1]) bounds[index === 0 ? 1 : 0] = next
    onChange(bounds)
  }
  const lo = normalize(value[0], min, max) * 100
  const hi = normalize(value[1], min, max) * 100
  return (
    <div className="artinos-range-control">
      <span>{label}</span>
      <div className="artinos-range-track">
        <i aria-hidden style={{ left: `${lo}%`, right: `${100 - hi}%` }} />
        <input type="range" min={min} max={max} step={step} value={value[0]} aria-label={`${label} minimum`} onChange={event => set(0, Number(event.target.value))} />
        <input type="range" min={min} max={max} step={step} value={value[1]} aria-label={`${label} maximum`} onChange={event => set(1, Number(event.target.value))} />
      </div>
      <output>
        {value[0].toFixed(2)} – {value[1].toFixed(2)}
        {unit ?? ''}
      </output>
    </div>
  )
}

/**
 * Dial — the same kernel mechanics on a vertical axis, so precision, detents and
 * keyboard behave identically to the scrub cell (they previously did not).
 */
export function Dial({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  disabled = false,
  onGestureStart,
  onGestureEnd,
  scheduler,
  physicsProfile,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  onGestureStart?(): void
  onGestureEnd?(): void
  scheduler?: ControlScheduler
  physicsProfile?: 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial'
  onChange(value: number): void
}) {
  const control = useControl({
    value, min, max, step, disabled, defaultValue: min,
    travel: DIAL_TRAVEL, axis: 'y', onChange, onGestureStart, onGestureEnd, scheduler, physicsProfile,
  })
  const { angle } = angularGeometry({ value, min, max })

  return (
    <div className="artinos-dial-control">
      <span>{label}</span>
      <button
        ref={control.ref as unknown as React.RefObject<HTMLButtonElement>}
        type="button"
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={unit ? `${value} ${unit}` : String(value)}
        disabled={disabled}
        {...control.attributes}
        {...control.handlers}
      >
        <i style={{ transform: `rotate(${angle}deg)` }} />
      </button>
      <output>
        {value.toFixed(step < 0.01 ? 3 : 2)}
        {unit ?? ''}
      </output>
    </div>
  )
}

NumberField.meta = controls.require('number-field')
RangeSlider.meta = controls.require('range-slider')
Dial.meta = controls.require('dial')
