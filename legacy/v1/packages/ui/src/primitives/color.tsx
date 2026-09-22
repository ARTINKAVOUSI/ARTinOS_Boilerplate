import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
export interface GradientValue { kind?: 'linear' | 'radial' | 'conic'; angle?: number; stops: Array<{ id?: string; offset: number; color: string }> }
import { colorPlaneGeometry, gradientStopGeometry } from '../kernel'
import { useControl, type ControlScheduler } from '../react/use-control'

export interface SemanticColorValue {
  space: 'srgb' | 'hsl' | 'oklch'
  channels: [number, number, number]
  alpha?: number
}

export type ColorValue = string | SemanticColorValue

export function colorToCSS(value: ColorValue): string {
  if (typeof value === 'string') return value
  const [a, b, c] = value.channels
  const alpha = value.alpha ?? 1
  if (value.space === 'hsl') return `hsl(${a} ${b * 100}% ${c * 100}% / ${alpha})`
  if (value.space === 'oklch') return `oklch(${a} ${b} ${c} / ${alpha})`
  return `rgb(${a * 255} ${b * 255} ${c * 255} / ${alpha})`
}

const colorChannels = (value: ColorValue): SemanticColorValue =>
  typeof value === 'string' ? { space: 'hsl', channels: [0, 1, 0.5], alpha: 1 } : value

export function ColorArea({
  label,
  value,
  hue = 0,
  disabled = false,
  onChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string
  value: readonly [number, number]
  hue?: number
  disabled?: boolean
  onChange(value: [number, number]): void
  onGestureStart?(): void
  onGestureEnd?(): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))
    onChange([x, y])
  }
  const keyboard = (event: KeyboardEvent) => {
    const amount = event.shiftKey ? 0.1 : event.altKey ? 0.005 : 0.02
    let [x, y] = value
    if (event.key === 'ArrowLeft') x -= amount
    else if (event.key === 'ArrowRight') x += amount
    else if (event.key === 'ArrowDown') y -= amount
    else if (event.key === 'ArrowUp') y += amount
    else return
    event.preventDefault()
    onChange([Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))])
  }
  const geometry = colorPlaneGeometry({ width: 100, height: 100, x: value[0], y: value[1], minX: 0, maxX: 1, minY: 0, maxY: 1, hue })
  return (
    <div className="artinos-color-area-wrap">
      <span>{label}</span>
      <div
        ref={ref}
        className="artinos-color-area"
        role="slider"
        aria-label={label}
        aria-valuetext={`Saturation ${Math.round(value[0] * 100)}%, lightness ${Math.round(value[1] * 100)}%`}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        style={{ '--color-hue': hue } as CSSProperties}
        onKeyDown={keyboard}
        onPointerDown={event => { if (disabled) return; event.currentTarget.setPointerCapture(event.pointerId); onGestureStart?.(); update(event) }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event) }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onGestureEnd?.() }}
        onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onGestureEnd?.() }}
      >
        <i style={{ left: `${geometry.handle.x}%`, top: `${geometry.handle.y}%` }} />
      </div>
    </div>
  )
}

export function ColorSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  gradient,
  scheduler,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  gradient?: string
  scheduler?: ControlScheduler
  onChange(value: number): void
}) {
  const control = useControl({ value, min, max, step, defaultValue: min, seekOnPress: true, scheduler, onChange })
  const t = (value - min) / (max - min || 1)
  return (
    <div className="artinos-color-slider-wrap">
      <span>{label}</span>
      <div ref={control.ref} className="artinos-color-slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} style={{ '--control-t': t, '--color-gradient': gradient } as CSSProperties} {...control.attributes} {...control.handlers}>
        <i />
      </div>
    </div>
  )
}

export function ColorWheel({ label, hue, scheduler, onChange }: { label: string; hue: number; scheduler?: ControlScheduler; onChange(hue: number): void }) {
  return <ColorSlider label={label} value={hue} min={0} max={360} step={1} gradient="linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" scheduler={scheduler} onChange={onChange} />
}

export function ColorSwatches({ label, value, colors, onChange }: { label: string; value: ColorValue; colors: ColorValue[]; onChange(value: ColorValue): void }) {
  return (
    <fieldset className="artinos-color-swatches">
      <legend>{label}</legend>
      {colors.map((color, index) => {
        const css = colorToCSS(color)
        return <button key={`${css}:${index}`} type="button" aria-label={css} aria-pressed={colorToCSS(value) === css} style={{ background: css }} onClick={() => onChange(color)} />
      })}
    </fieldset>
  )
}

export function ColorControl({ label, value, scheduler, onChange }: { label: string; value: ColorValue; scheduler?: ControlScheduler; onChange(value: ColorValue): void }) {
  const semantic = colorChannels(value)
  const [hue, saturation, lightness] = semantic.channels
  const commit = (channels: [number, number, number]) => onChange({ ...semantic, space: 'hsl', channels })
  return (
    <div className="artinos-color-control">
      <ColorArea label={label} value={[saturation, lightness]} hue={hue} onChange={([s, l]) => commit([hue, s, l])} />
      <ColorWheel label="Hue" hue={hue} scheduler={scheduler} onChange={next => commit([next, saturation, lightness])} />
      <ColorSlider label="Alpha" value={semantic.alpha ?? 1} scheduler={scheduler} onChange={alpha => onChange({ ...semantic, alpha })} />
    </div>
  )
}

export function GradientEditor({
  label,
  value,
  selectedId,
  onSelectionChange,
  onChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string
  value: GradientValue
  selectedId?: string
  onSelectionChange?(id: string): void
  onChange(value: GradientValue): void
  onGestureStart?(): void
  onGestureEnd?(): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [localSelection, setLocalSelection] = useState(value.stops[0]?.id)
  const selected = selectedId ?? localSelection
  const choose = (id: string) => { setLocalSelection(id); onSelectionChange?.(id) }
  const updateStop = (id: string, offset: number) => onChange({
    ...value,
    stops: value.stops.map(stop => stop.id === id ? { ...stop, offset: Math.max(0, Math.min(1, offset)) } : stop).sort((a, b) => a.offset - b.offset),
  })
  const positions = gradientStopGeometry(value.stops, 100)
  const css = `${value.kind ?? 'linear'}-gradient(${value.kind === 'linear' ? `${value.angle ?? 90}deg,` : ''}${[...value.stops].sort((a,b)=>a.offset-b.offset).map(stop => `${stop.color} ${stop.offset * 100}%`).join(',')})`
  return (
    <div className="artinos-gradient-editor">
      <span>{label}</span>
      <div ref={ref} className="artinos-gradient-editor__rail" style={{ backgroundImage: css }}>
        {positions.map((position, index) => {
          const stop = value.stops[index]
          const id = stop.id ?? `stop-${index}`
          return (
            <button
              key={id}
              type="button"
              aria-label={`Gradient stop ${index + 1}`}
              aria-pressed={selected === id}
              style={{ left: `${position.x}%`, '--stop-color': stop.color } as CSSProperties}
              onFocus={() => choose(id)}
              onKeyDown={event => {
                const step = event.shiftKey ? 0.1 : 0.01
                if (event.key === 'ArrowLeft') { event.preventDefault(); updateStop(id, stop.offset - step) }
                else if (event.key === 'ArrowRight') { event.preventDefault(); updateStop(id, stop.offset + step) }
                else if ((event.key === 'Delete' || event.key === 'Backspace') && value.stops.length > 2) {
                  event.preventDefault(); onChange({ ...value, stops: value.stops.filter((_, stopIndex) => stopIndex !== index) })
                }
              }}
              onPointerDown={event => { choose(id); event.currentTarget.setPointerCapture(event.pointerId); onGestureStart?.() }}
              onPointerMove={event => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                const rect = ref.current?.getBoundingClientRect()
                if (rect) updateStop(id, (event.clientX - rect.left) / rect.width)
              }}
              onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); onGestureEnd?.() }}
            />
          )
        })}
      </div>
      <button type="button" onClick={() => {
        const id = `stop-${Date.now().toString(36)}`
        onChange({ ...value, stops: [...value.stops, { id, offset: 0.5, color: '#ffffff' }].sort((a,b)=>a.offset-b.offset) })
        choose(id)
      }}>Add stop</button>
    </div>
  )
}
