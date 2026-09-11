import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
export interface CurvePoint { id?: string; x: number; y: number; interpolation?: string; handles?: number[] }
export interface CurveValue { points: CurvePoint[]; closed?: boolean }
export interface EnvelopeValue { attack: number; decay: number; sustain: number; release: number; [key: string]: number }
import { curveGeometry } from '../kernel'
import type { ControlScheduler } from '../react/use-control'
import { Slider } from './numeric'

const pointId = () => `point-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
const ordered = (points: CurvePoint[]) => [...points].sort((a, b) => a.x - b.x)

export function CurveControl({
  label,
  value,
  min = 0,
  max = 1,
  selectedIds,
  onSelectionChange,
  onChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string
  value: CurveValue
  min?: number
  max?: number
  selectedIds?: string[]
  onSelectionChange?(ids: string[]): void
  onChange(value: CurveValue): void
  onGestureStart?(): void
  onGestureEnd?(): void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [selection, setSelection] = useState<string[]>(selectedIds ?? [])
  const points = ordered(value.points.map((point, index) => ({ ...point, id: point.id ?? `point-${index}` })))
  const selected = selectedIds ?? selection
  const select = (id: string, additive = false) => {
    const next = additive ? [...new Set([...selected, id])] : [id]
    setSelection(next); onSelectionChange?.(next)
  }
  const commitPoint = (id: string, x: number, y: number) => onChange({
    ...value,
    points: ordered(points.map(point => point.id === id ? { ...point, x: Math.max(0, Math.min(1, x)), y: Math.max(min, Math.min(max, y)) } : point)),
  })
  const updateFromPointer = (id: string, event: PointerEvent<SVGCircleElement>) => {
    const rect = svg.current?.getBoundingClientRect()
    if (!rect) return
    commitPoint(id, (event.clientX - rect.left) / rect.width, max - (event.clientY - rect.top) / rect.height * (max - min))
  }
  const keyboard = (point: CurvePoint, event: KeyboardEvent) => {
    const amount = event.shiftKey ? 0.1 : event.altKey ? 0.002 : 0.01
    if (event.key === 'ArrowLeft') commitPoint(point.id as string, point.x - amount, point.y)
    else if (event.key === 'ArrowRight') commitPoint(point.id as string, point.x + amount, point.y)
    else if (event.key === 'ArrowDown') commitPoint(point.id as string, point.x, point.y - amount * (max - min))
    else if (event.key === 'ArrowUp') commitPoint(point.id as string, point.x, point.y + amount * (max - min))
    else if ((event.key === 'Delete' || event.key === 'Backspace') && points.length > 2) {
      onChange({ ...value, points: points.filter(candidate => candidate.id !== point.id) })
    } else return
    event.preventDefault()
  }
  const geometry = curveGeometry(points.map(point => ({ id: point.id, x: point.x, y: (point.y - min) / (max - min || 1) })), 100, 100)
  const path = geometry.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ')
  return (
    <div className="artinos-curve-control">
      <header><span>{label}</span><button type="button" onClick={() => {
        const point: CurvePoint = { id: pointId(), x: 0.5, y: (min + max) / 2, interpolation: 'smooth' }
        onChange({ ...value, points: ordered([...points, point]) }); select(point.id as string)
      }}>Add point</button></header>
      <svg ref={svg} viewBox="0 0 100 100" preserveAspectRatio="none" role="application" aria-label={label}>
        <path d={path} />
        {geometry.map((position, index) => {
          const point = points[index]
          return (
            <circle
              key={point.id}
              cx={position.x}
              cy={position.y}
              r="2.8"
              tabIndex={0}
              role="slider"
              aria-label={`Point ${index + 1}`}
              aria-valuetext={`${point.x.toFixed(3)}, ${point.y.toFixed(3)}`}
              data-selected={selected.includes(point.id as string) || undefined}
              onFocus={() => select(point.id as string)}
              onKeyDown={event => keyboard(point, event)}
              onPointerDown={event => { select(point.id as string, event.shiftKey); event.currentTarget.setPointerCapture(event.pointerId); onGestureStart?.(); updateFromPointer(point.id as string, event) }}
              onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(point.id as string, event) }}
              onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); onGestureEnd?.() }}
              onPointerCancel={event => { event.currentTarget.releasePointerCapture(event.pointerId); onGestureEnd?.() }}
            />
          )
        })}
      </svg>
    </div>
  )
}

export function EnvelopeEditor({
  label,
  value,
  scheduler,
  onChange,
}: {
  label: string
  value: EnvelopeValue
  scheduler?: ControlScheduler
  onChange(value: EnvelopeValue): void
}) {
  const fields: Array<{ key: keyof EnvelopeValue; label: string; min: number; max: number; step: number }> = useMemo(() => [
    { key: 'attack', label: 'Attack', min: 0, max: 10, step: 0.01 },
    { key: 'decay', label: 'Decay', min: 0, max: 10, step: 0.01 },
    { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01 },
    { key: 'release', label: 'Release', min: 0, max: 20, step: 0.01 },
  ], [])
  return (
    <div className="artinos-envelope-editor" aria-label={label}>
      <strong>{label}</strong>
      {fields.map(field => (
        <Slider key={field.key} label={field.label} value={Number(value[field.key] ?? 0)} min={field.min} max={field.max} step={field.step} unit={field.key === 'sustain' ? undefined : 's'} scheduler={scheduler} onChange={next => onChange({ ...value, [field.key]: next })} />
      ))}
    </div>
  )
}

export function GraphEditor(props: Parameters<typeof CurveControl>[0]) {
  return <div className="artinos-graph-editor"><CurveControl {...props} /></div>
}
