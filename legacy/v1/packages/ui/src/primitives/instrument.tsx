import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { InteractionTracker, PHYSICS_PROFILES, planarGeometry, normalize, denormalize, stepPhysicalState, type PhysicalState } from '../kernel'
import { useControl, type ControlScheduler } from '../react/use-control'
import { controls } from './control-registry'

/**
 * Instrument controls (PRD §37 B) — the family that defines the system.
 *
 * All of them read geometry from the kernel and, where they are draggable, take
 * their mechanics from `useControl`. None re-implements pointer handling.
 */

/* ── Meter ─────────────────────────────────────────────────────────────── */

export function Meter({
  label,
  value,
  min = 0,
  max = 1,
  unit,
  status,
}: {
  label: string
  value: number
  min?: number
  max?: number
  unit?: string
  status?: 'live' | 'warn' | 'fault'
}) {
  const t = Math.max(0, Math.min(1, normalize(value, min, max)))
  return (
    <div className="artinos-meter" data-state={status}>
      <span>{label}</span>
      <div>
        <i style={{ width: `${t * 100}%` }} />
      </div>
      <output>
        {value.toFixed(2)}
        {unit && <em>{unit}</em>}
      </output>
    </div>
  )
}

/* ── XY Pad ────────────────────────────────────────────────────────────── */

export interface XYPadProps {
  label: string
  value: [number, number]
  min?: [number, number]
  max?: [number, number]
  onChange(value: [number, number]): void
  onGestureStart?(): void
  onGestureEnd?(): void
}

/**
 * Two axes driven together. Uses `planarGeometry` for the handle so the mapping
 * matches every other control, including the screen-y flip.
 */
export function XYPad({
  label,
  value,
  min = [0, 0],
  max = [1, 1],
  onChange,
  onGestureStart,
  onGestureEnd,
}: XYPadProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const tracker = useMemo(() => new InteractionTracker('x'), [])

  const geometry = useMemo(
    () =>
      planarGeometry({
        width: 100,
        height: 100,
        x: value[0],
        y: value[1],
        minX: min[0],
        maxX: max[0],
        minY: min[1],
        maxY: max[1],
      }),
    [value, min, max],
  )

  const seek = (event: { clientX: number; clientY: number }) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const ny = Math.max(0, Math.min(1, (rect.bottom - event.clientY) / rect.height))
    onChange([denormalize(nx, min[0], max[0]), denormalize(ny, min[1], max[1])])
  }

  const begin = (event: ReactPointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    setDragging(true)
    tracker.begin(event, event.timeStamp)
    event.currentTarget.setPointerCapture(event.pointerId)
    onGestureStart?.()
    seek(event)
  }

  const move = (event: ReactPointerEvent) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    tracker.move(event, event.timeStamp)
    seek(event)
  }
  const end = (event: ReactPointerEvent, cancelled = false) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    tracker.end(event, event.timeStamp, cancelled)
    setDragging(false)
    onGestureEnd?.()
  }
  const keyboard = (event: KeyboardEvent) => {
    const amount = event.shiftKey ? 0.1 : event.altKey ? 0.002 : 0.01
    let [x, y] = value
    if (event.key === 'ArrowLeft') x -= amount * (max[0] - min[0])
    else if (event.key === 'ArrowRight') x += amount * (max[0] - min[0])
    else if (event.key === 'ArrowDown') y -= amount * (max[1] - min[1])
    else if (event.key === 'ArrowUp') y += amount * (max[1] - min[1])
    else return
    event.preventDefault()
    onChange([Math.max(min[0], Math.min(max[0], x)), Math.max(min[1], Math.min(max[1], y))])
  }

  return (
    <div className="artinos-xypad-wrap">
      <span>{label}</span>
      <div
        ref={ref}
        className="artinos-xypad"
        data-state={dragging ? 'dragging' : undefined}
        role="application"
        aria-label={label}
        aria-valuetext={`${value[0].toFixed(3)}, ${value[1].toFixed(3)}`}
        tabIndex={0}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={event => end(event)}
        onPointerCancel={event => end(event, true)}
        onKeyDown={keyboard}
      >
        <i style={{ left: `${geometry.handle.x}%`, top: `${geometry.handle.y}%` }} />
      </div>
      <output>
        {value[0].toFixed(2)}, {value[1].toFixed(2)}
      </output>
    </div>
  )
}

XYPad.meta = controls.require('xy-pad')

export function Joystick({
  label,
  value,
  min = [-1, -1],
  max = [1, 1],
  center = [0, 0],
  scheduler,
  onChange,
}: XYPadProps & { center?: [number, number]; scheduler?: ControlScheduler }) {
  const id = useId()
  const settle = () => {
    if (!scheduler) { onChange(center); return }
    let x: PhysicalState = { value: value[0], target: center[0], velocity: 0, phase: 'spring' }
    let y: PhysicalState = { value: value[1], target: center[1], velocity: 0, phase: 'spring' }
    let previous = globalThis.performance?.now() ?? Date.now()
    const tick = () => {
      const current = globalThis.performance?.now() ?? Date.now()
      const dt = (current - previous) / 1_000
      previous = current
      x = stepPhysicalState(x, PHYSICS_PROFILES.mechanical, dt)
      y = stepPhysicalState(y, PHYSICS_PROFILES.mechanical, dt)
      onChange([x.value, y.value])
      if (x.phase !== 'idle' || y.phase !== 'idle') scheduler.schedule(`joystick:${id}`, 'animation-frame', tick, { value: undefined })
    }
    scheduler.schedule(`joystick:${id}`, 'animation-frame', tick, { value: undefined })
  }
  return <XYPad label={label} value={value} min={min} max={max} onChange={onChange} onGestureStart={undefined} onGestureEnd={settle} />
}

/* ── Knob ──────────────────────────────────────────────────────────────── */

export function Knob({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  detents,
  onChange,
  onGestureStart,
  onGestureEnd,
  scheduler,
  physicsProfile,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  detents?: readonly number[]
  onChange(value: number): void
  onGestureStart?(): void
  onGestureEnd?(): void
  scheduler?: ControlScheduler
  physicsProfile?: 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial'
}) {
  const control = useControl({
    value, min, max, step, detents, defaultValue: min,
    travel: 160, axis: 'y', onChange, onGestureStart, onGestureEnd, scheduler, physicsProfile,
  })
  const t = Math.max(0, Math.min(1, normalize(value, min, max)))
  const angle = -135 + t * 270

  return (
    <div className="artinos-knob" {...control.attributes}>
      <div
        ref={control.ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={unit ? `${value} ${unit}` : String(value)}
        className="artinos-knob-dial"
        style={{ ['--control-t' as string]: String(t) }}
        {...control.handlers}
      >
        <i style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <span>{label}</span>
      <output>
        <span ref={control.liveRef as React.RefObject<HTMLSpanElement>}>{value.toFixed(2)}</span>
        {unit && <em>{unit}</em>}
      </output>
    </div>
  )
}

/* ── Waveform / Graph ──────────────────────────────────────────────────── */

/**
 * Scope for a sampled series. Renders as an SVG polyline so it stays crisp and
 * stylable from tokens; the caller owns the sampling rate.
 */
export function Waveform({
  label,
  samples,
  min = -1,
  max = 1,
  status,
}: {
  label?: string
  samples: readonly number[]
  min?: number
  max?: number
  status?: 'live' | 'warn' | 'fault'
}) {
  const points = useMemo(() => {
    if (!samples.length) return ''
    const step = 100 / Math.max(1, samples.length - 1)
    return samples
      .map((s, i) => `${(i * step).toFixed(2)},${((1 - normalize(s, min, max)) * 100).toFixed(2)}`)
      .join(' ')
  }, [samples, min, max])

  return (
    <div className="artinos-waveform" data-state={status}>
      {label && <span>{label}</span>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

/* ── Envelope ──────────────────────────────────────────────────────────── */

export interface EnvelopePoint {
  time: number
  value: number
}

/** ADSR-style breakpoint display. Editing lands with the curve editor. */
export function Envelope({ label, points, status }: { label: string; points: readonly EnvelopePoint[]; status?: 'live' | 'warn' }) {
  const path = useMemo(
    () => points.map((p, i) => `${i ? 'L' : 'M'}${(p.time * 100).toFixed(2)},${((1 - p.value) * 100).toFixed(2)}`).join(' '),
    [points],
  )
  return (
    <div className="artinos-envelope" data-state={status}>
      <span>{label}</span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d={path} fill="none" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.time * 100} cy={(1 - p.value) * 100} r="1.6" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  )
}

/* ── Gradient ──────────────────────────────────────────────────────────── */

export interface GradientStop {
  offset: number
  color: string
}

export function GradientBar({ label, stops }: { label: string; stops: readonly GradientStop[] }) {
  const css = useMemo(
    () => `linear-gradient(90deg, ${[...stops].sort((a, b) => a.offset - b.offset).map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`,
    [stops],
  )
  return (
    <div className="artinos-gradient">
      <span>{label}</span>
      <div className="artinos-gradient-bar" style={{ backgroundImage: css }}>
        {stops.map((s, i) => (
          <i key={i} style={{ left: `${s.offset * 100}%` }} />
        ))}
      </div>
    </div>
  )
}

Meter.meta = controls.require('meter')
Knob.meta = controls.require('knob')
Waveform.meta = controls.require('waveform')
Envelope.meta = controls.require('envelope')
GradientBar.meta = controls.require('gradient-editor')
