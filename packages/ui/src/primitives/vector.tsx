import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { controls } from './control-registry'
import { Field } from './field'
import { NumberWell } from './numeric-input'

const AXES = ['X', 'Y', 'Z', 'W']

/**
 * ColorField — the swatch (reference `.swatch`): the surface is the
 * visualization. The whole bar is the colour, a gloss rides its top, the hex and
 * alpha sit on it in the numeral face, and the native picker lies invisibly on top.
 *
 * With `hideLabel` the swatch stands alone at full width; otherwise it sits in a row.
 */
export function ColorField({
  label,
  value,
  alpha = '100%',
  hideLabel = false,
  onChange,
}: {
  label: string
  value: string
  /** Shown at the right edge of the swatch. */
  alpha?: string
  hideLabel?: boolean
  onChange(value: string): void
}) {
  const swatch = (
    <label className="artinos-color-field" style={{ '--swatch': value } as CSSProperties}>
      <input type="color" value={value} aria-label={label} onChange={event => onChange(event.target.value)} />
      <span>{value.replace('#', '').toUpperCase()}</span>
      <span>{alpha}</span>
    </label>
  )
  return hideLabel ? swatch : <Field label={label}>{swatch}</Field>
}

/** ColorRamp — a reference gradient with its three stop labels. */
export function ColorRamp({
  label,
  stops,
  labels,
}: {
  label: string
  stops?: string[]
  labels?: [string, string, string]
}) {
  return (
    <>
      <div
        className="artinos-color-ramp"
        role="img"
        aria-label={label}
        style={stops ? ({ '--ramp': `linear-gradient(90deg, ${stops.join(', ')})` } as CSSProperties) : undefined}
      />
      {labels && (
        <div className="artinos-color-ramp-labels">
          {labels.map(text => (
            <span key={text}>{text}</span>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * HueBar — the hue rail (reference `.hue`): a 13px spectrum with a 7px thumb cut
 * from the active material. Drag along it, or use the arrow keys — five degrees
 * a press, one with Shift.
 */
export function HueBar({ label, value, onChange }: { label: string; value: number; onChange(hue: number): void }) {
  const rail = useRef<HTMLDivElement>(null)
  const hue = ((value % 360) + 360) % 360

  const place = (event: ReactPointerEvent) => {
    const rect = rail.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    onChange(Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * 360))
  }

  return (
    <div
      ref={rail}
      className="artinos-hue"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      style={{ '--hue-t': String(hue / 360) } as CSSProperties}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId)
        place(event)
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) place(event)
      }}
      onKeyDown={event => {
        const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
        if (!direction) return
        event.preventDefault()
        onChange((((hue + direction * (event.shiftKey ? 1 : 5)) % 360) + 360) % 360)
      }}
    >
      <span className="artinos-hue-thumb" aria-hidden />
    </div>
  )
}

/** VectorField — a named row of scrubbable axis wells (reference `.mc__vec`). */
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
  const axes = AXES.slice(0, dimensions)
  return (
    <Field label={label} className="artinos-vector-field">
      <div className="artinos-vector-axes" style={{ '--axes': dimensions } as CSSProperties}>
        {axes.map((axis, index) => (
          <NumberWell
            key={axis}
            axis={axis}
            label={`${label} ${axis}`}
            step={step}
            value={value[index] ?? 0}
            onChange={number => {
              const next = [...value]
              next[index] = number
              onChange(next)
            }}
          />
        ))}
      </div>
    </Field>
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
