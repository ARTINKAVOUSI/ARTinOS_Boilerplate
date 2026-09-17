import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { angularGeometry, DIAL_TRAVEL, normalize } from '../kernel'
import { useControl, type ControlScheduler } from '../react/use-control'
import { runSpring } from '../react/use-spring'
import { controls } from './control-registry'
import { Field, PinButton, type FieldLayout } from './field'
import { NumberWell } from './numeric-input'

export interface SliderProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  /** Where a double-click returns the value. Defaults to `min`. */
  defaultValue?: number
  disabled?: boolean
  readOnly?: boolean
  /** Values that magnetise the drag, in addition to the capsule's quarter detents. */
  detents?: readonly number[]
  /** Shown after the name — names the source when a parameter is externally driven. */
  binding?: string
  /** Signal state. `bound` is set automatically when `binding` is present. */
  status?: 'bound' | 'warn' | 'fault'
  /** `inline` (the default) draws the name inside the capsule; `row` puts it in a column beside it. */
  layout?: FieldLayout
  /** `compact` is the 19px capsule (reference `.mc--compact`). */
  size?: 'default' | 'compact'
  /** `ticked` keeps the tick band visible at rest. */
  variant?: 'default' | 'ticked'
  /** Renders the modulation marker; lit when `pinned`. */
  pinned?: boolean
  onPinnedChange?(pinned: boolean): void
  /** Opened when a gesture starts; use it to open a history transaction. */
  onGestureStart?(): void
  onGestureEnd?(): void
  /** Called after a double-click has returned the value to `defaultValue`. */
  onReset?(): void
  scheduler?: ControlScheduler
  physicsProfile?: 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial'
  onChange(value: number): void
}

/**
 * The reference instrument's feel: Shift refines to 0.18×, a slow drag refines
 * to 0.55× on its own, quarter detents pull only while moving deliberately, and
 * an arrow key moves a hundredth of the range (a tenth with Page Up/Down).
 */
const INSTRUMENT_FEEL = {
  precisionKey: 'shift',
  precisionFactor: 0.18,
  slowPrecision: { below: 0.12, factor: 0.55 },
  softDetents: { at: [0, 0.25, 0.5, 0.75, 1], radius: 0.012, below: 0.35 },
  nudgeFraction: 0.01,
  fastVelocity: 0.9,
} as const

/** Contact compression — how far the capsule gives under the hand. */
const CONTACT_POSE = 0.985

function decimalsFor(step: number): number {
  if (step >= 1) return 0
  return Math.min(3, (String(step).split('.')[1] ?? '').length || 2)
}

/** Kelvin groups its thousands with a space, as the reference does ("5 600"). */
function formatValue(value: number, decimals: number, unit?: string): string {
  const fixed = value.toFixed(decimals)
  if (unit !== 'K') return fixed
  const [whole, fraction] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/**
 * Slider — the capsule (reference `.cap`), the full-surface instrument.
 *
 * The whole capsule is the control. A denser active insert moves through a
 * softer body; a seam marks the exact value; the name and value ride inside in
 * two inks, clipped at the seam, so both halves stay readable whichever side of
 * the seam they fall on. Press anywhere to place the value, then drag relative
 * from there. Double-click resets. Enter types a value.
 *
 * Anatomy: Field · Capsule · Fill · Ticks · Seam · Text(off) · Text(on) · Marker.
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  defaultValue,
  disabled = false,
  readOnly = false,
  detents,
  binding,
  status,
  layout = 'inline',
  size = 'default',
  variant = 'default',
  pinned,
  onPinnedChange,
  onGestureStart,
  onGestureEnd,
  onReset,
  scheduler,
  physicsProfile,
  onChange,
}: SliderProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [pressed, setPressed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const labelId = useId()
  const decimals = decimalsFor(step)
  const display = formatValue(value, decimals, unit)

  const control = useControl({
    value,
    min,
    max,
    step,
    detents,
    defaultValue: defaultValue ?? min,
    disabled: disabled || editing !== null,
    readOnly,
    onChange,
    onGestureStart,
    onGestureEnd,
    scheduler,
    physicsProfile,
    seekOnPress: true,
    ...INSTRUMENT_FEEL,
  })

  control.setFormatter(v => formatValue(v, decimals, unit))

  useEffect(() => {
    if (editing !== null) inputRef.current?.select()
  }, [editing])

  // Contact compression on grab, a material rebound on release — on the spring
  // of whichever world the capsule sits in.
  const dragging = control.isDragging
  const posed = useRef(false)
  const cancelPose = useRef<() => void>(() => {})
  useEffect(() => {
    if (dragging === posed.current) return
    posed.current = dragging
    const element = control.ref.current
    cancelPose.current()
    cancelPose.current = runSpring(element, dragging ? 1 : CONTACT_POSE, dragging ? CONTACT_POSE : 1, pose => {
      element?.style.setProperty('--pose-y', pose.toFixed(4))
    })
  }, [dragging, control.ref])
  useEffect(() => () => cancelPose.current(), [])

  const commit = () => {
    if (editing === null) return
    const parsed = parseFloat(editing.replace(/\s/g, ''))
    if (!Number.isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
    setEditing(null)
  }

  const t = max === min ? 0 : Math.min(1, Math.max(0, normalize(value, min, max)))
  const state = status && !control.isDragging ? status : undefined

  const readout = (live: boolean) => (
    <span className="artinos-range-value">
      <span
        ref={live ? (control.liveRef as React.RefObject<HTMLSpanElement>) : undefined}
        data-live-mirror={live ? undefined : ''}
      >
        {display}
      </span>
      {unit && <i>{unit}</i>}
    </span>
  )

  return (
    <Field
      className="artinos-slider"
      label={
        <>
          {label}
          {binding && <em className="artinos-field-binding">{binding}</em>}
        </>
      }
      labelId={labelId}
      layout={layout}
      trailing={onPinnedChange ? <PinButton label={label} pinned={Boolean(pinned)} onChange={onPinnedChange} /> : undefined}
    >
      <div
        ref={control.ref}
        className="artinos-range"
        data-size={size === 'compact' ? 'compact' : undefined}
        data-variant={variant === 'ticked' ? 'ticked' : undefined}
        data-disabled={disabled || undefined}
        data-pressed={pressed || undefined}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${display}${unit ?? ''}`}
        aria-disabled={disabled || undefined}
        aria-readonly={readOnly || undefined}
        {...control.attributes}
        data-state={state ?? control.attributes['data-state']}
        {...control.handlers}
        onPointerDown={event => {
          // The kernel cancels the default so a drag never selects text, which also
          // cancels focus. Take it explicitly, then let the fill dip for a beat.
          if (!disabled) event.currentTarget.focus({ preventScroll: true })
          if (!disabled && !readOnly && event.button === 0) {
            setPressed(true)
            window.setTimeout(() => setPressed(false), 120)
          }
          control.handlers.onPointerDown(event)
        }}
        onDoubleClick={() => {
          if (disabled || readOnly) return
          control.handlers.onDoubleClick()
          onReset?.()
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !disabled && !readOnly) {
            event.preventDefault()
            setEditing(display)
            return
          }
          control.handlers.onKeyDown(event)
        }}
        // Fill, seam and both inks follow --control-t, which useControl writes
        // straight to this element during a drag. React only seeds it.
        style={{ '--control-t': String(t) } as CSSProperties}
      >
        <span className="artinos-range-fill" aria-hidden />
        <span className="artinos-range-ticks" aria-hidden />
        <span className="artinos-range-seam" aria-hidden />
        {editing !== null ? (
          <input
            ref={inputRef}
            className="artinos-range-input"
            aria-label={label}
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
          <>
            <span className="artinos-range-text" data-ink="off" aria-hidden>
              <span className="artinos-range-name">{label}</span>
              {readout(true)}
            </span>
            <span className="artinos-range-text" data-ink="on" aria-hidden>
              <span className="artinos-range-name">{label}</span>
              {readout(false)}
            </span>
          </>
        )}
      </div>
    </Field>
  )
}

Slider.meta = controls.require('slider')

/** NumberField — a named row with a recessed, scrubbable number well (reference `.field`). */
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
    <Field label={label}>
      <NumberWell label={label} value={value} min={min} max={max} step={step} unit={unit} onChange={onChange} />
    </Field>
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
 * keyboard behave identically to the slider.
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
