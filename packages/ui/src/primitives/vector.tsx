import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { controls } from './control-registry'
import { NumericInput } from './numeric-input'

const AXES = ['X', 'Y', 'Z', 'W']

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="artinos-control">
      <span>{label}</span>
      <input type="color" value={value} onChange={event => onChange(event.target.value)} />
      <input value={value} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

export function VectorField({
  label,
  value,
  dimensions = 3,
  step = 0.01,
  onChange,
}: {
  label: string
  value: number[]
  dimensions?: 2 | 3 | 4
  step?: number
  onChange(value: number[]): void
}) {
  return (
    <div className="artinos-vector">
      <span>{label}</span>
      <div>
        {Array.from({ length: dimensions }, (_, index) => (
          <label key={index}>
            <small>{AXES[index]}</small>
            <NumericInput
              label={`${label} ${AXES[index]}`}
              step={step}
              value={value[index] ?? 0}
              onChange={number => {
                const next = [...value]
                next[index] = number
                onChange(next)
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

export function XYZControl(props: Omit<Parameters<typeof VectorField>[0], 'dimensions'>) {
  return <VectorField {...props} dimensions={3} />
}

export function QuaternionControl(props: Omit<Parameters<typeof VectorField>[0], 'dimensions'>) {
  const normalized = () => {
    const length = Math.hypot(...props.value) || 1
    props.onChange(props.value.map(component => component / length))
  }
  return (
    <div className="artinos-quaternion-control">
      <VectorField {...props} dimensions={4} />
      <button type="button" onClick={normalized}>Normalize</button>
    </div>
  )
}

export function MatrixControl({ label, value, size = Math.sqrt(value.length) || 4, onChange }: { label: string; value: number[]; size?: number; onChange(value: number[]): void }) {
  return <fieldset className="artinos-matrix-control"><legend>{label}</legend><div style={{ gridTemplateColumns: `repeat(${size},minmax(0,1fr))` }}>{value.map((entry, index) => <label key={index}><small>{Math.floor(index / size) + 1},{index % size + 1}</small><input type="number" step={.001} value={entry} onChange={event => onChange(value.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} /></label>)}</div></fieldset>
}

export interface ObjectReferenceValue { id: string; path?: string; label?: string; type?: string }
export function ObjectReferenceField({ label, value, onChange }: { label: string; value: ObjectReferenceValue; onChange(value: ObjectReferenceValue): void }) {
  return <label className="artinos-object-reference"><span>{label}</span><input value={value.label ?? value.path ?? value.id} onChange={event => onChange({ ...value, label: event.target.value })} /><code>{value.type ?? 'object'} · {value.id}</code></label>
}

export function XYPad({
  label,
  value = [0, 0],
  min = -1,
  max = 1,
  onChange,
}: {
  label: string
  value?: [number, number]
  min?: number
  max?: number
  onChange(value: [number, number]): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const update = (event: ReactPointerEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    // Y is inverted: screen-down is value-down.
    onChange([min + x * (max - min), max - y * (max - min)])
  }

  const left = ((value[0] - min) / (max - min)) * 100
  const top = ((max - value[1]) / (max - min)) * 100
  return (
    <div className="artinos-xypad-wrap">
      <span>{label}</span>
      <div
        ref={ref}
        className="artinos-xypad"
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          update(event)
        }}
        onPointerMove={event => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
        }}
      >
        <i style={{ left: `${left}%`, top: `${top}%` }} />
      </div>
    </div>
  )
}

ColorField.meta = controls.require('color-field')
VectorField.meta = controls.require('vector-field')
XYPad.meta = controls.require('xy-pad')
