import { useEffect, useRef, useState } from 'react'
import { useArtinosRuntime, type CurveValue, type EnvelopeValue, type GradientValue, type ParameterDefinition, type ParameterValue } from '@artinos/runtime'
import { LATTICE, presentationForWidth, type ParameterKind } from '../kernel'
import { controls, type PresentationId } from './control-registry'
import { ComponentRenderer } from '../react/render-component'

const VECTOR_DIMENSIONS = { vec2: 2, vec3: 3, vec4: 4 } as const

export interface ParameterControlProps {
  definition: ParameterDefinition
  value: ParameterValue
  onChange(value: ParameterValue): void
  /** Forwarded to continuous controls so a drag becomes one history action. */
  onGestureStart?(): void
  onGestureEnd?(): void
  /** Signal state, resolved from the parameter's write source and validity. */
  status?: 'bound' | 'warn' | 'fault'
  /** Names the driver when the value is externally controlled. */
  binding?: string
  /** Force a presentation. Ignored if it is not registered for this kind. */
  presentation?: PresentationId | (string & {})
  autoFocus?: boolean
}

/**
 * Presents one parameter.
 *
 * The parameter's kind and the available width go to the control registry, which
 * answers with a presentation — so a vec2 becomes an XY pad when there is room
 * for one and a vector field when there is not, without this file growing a
 * branch per case (PRD §13, §25).
 *
 * Adding a new presentation means registering it in `control-registry.ts` and
 * rendering it below; nothing else in the system needs to change.
 */
export function ParameterControl({
  definition,
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  status,
  binding,
  presentation,
  autoFocus = false,
}: ParameterControlProps) {
  const label = definition.label ?? definition.id
  const runtime = useArtinosRuntime()
  const kind = definition.type as ParameterKind
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(Infinity)

  useEffect(() => {
    if (autoFocus) ref.current?.querySelector<HTMLElement>('input, select, textarea, button, [tabindex="0"]')?.focus()
  }, [autoFocus])

  // Adaptive presentation is a measurement, not a breakpoint: the control reads
  // the space it was actually given (PRD §6, §25).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hint = presentation ?? definition.presentation?.preferred
  const chosen = controls.resolveControl({ type: kind, width, hint: !hint && kind === 'enum' && (definition.options?.length ?? 0) > 4 ? 'select' : hint })
  const density = width === Infinity ? 'large' : presentationForWidth(width, LATTICE.standard)
  const unit = typeof definition.unit === 'string' ? definition.unit : definition.unit?.symbol

  const numeric = {
    min: definition.min,
    max: definition.max,
    step: definition.step,
    unit,
    onGestureStart,
    onGestureEnd,
    disabled: definition.presentation?.hidden,
    readOnly: definition.presentation?.readOnly,
    scheduler: runtime.scheduler,
    physicsProfile: definition.metadata?.physicsProfile as 'precise' | 'soft' | 'mechanical' | 'elastic' | 'magnetic' | 'inertial' | undefined,
  }

  const componentProps = () => {
    switch (chosen?.id) {
      case 'dial':
      case 'knob':
        return { label, value: Number(value), ...numeric, onChange: onChange as (v: number) => void }
      case 'meter':
        return { label, value: Number(value), min: definition.min, max: definition.max, unit }
      case 'field':
        return { label, value: Number(value), min: definition.min, max: definition.max, step: definition.step, unit, onChange: onChange as (v: number) => void }
      case 'range':
        return { label, value: (Array.isArray(value) ? value : [0, 1]) as [number, number], min: definition.min, max: definition.max, step: definition.step, unit, onChange: onChange as (v: [number, number]) => void }
      case 'scrub':
        return { label, value: Number(value), ...numeric, status, binding, onChange: onChange as (v: number) => void }
      case 'toggle':
        return { label, value: Boolean(value), onChange: onChange as (v: boolean) => void }
      case 'segmented':
        return { label, value: String(value), options: definition.options ?? [], onChange }
      case 'select':
        return { label, value, options: definition.options ?? [], onChange }
      case 'color':
        return { label, value: String(value), onChange: onChange as (v: string) => void }
      case 'xy':
        return {
          label,
          value: (Array.isArray(value) ? value : [0, 0]) as [number, number],
          min: definition.min === undefined ? undefined : [definition.min, definition.min],
          max: definition.max === undefined ? undefined : [definition.max, definition.max],
          onChange: onChange as (v: [number, number]) => void,
        }
      case 'vector':
        return {
          label,
          value: Array.isArray(value) ? value as number[] : [],
          dimensions: definition.type === 'range' ? 2 : VECTOR_DIMENSIONS[definition.type as keyof typeof VECTOR_DIMENSIONS] ?? (definition.type === 'quaternion' ? 4 : 3),
          step: definition.step,
          onChange: onChange as (v: number[]) => void,
        }
      case 'matrix':
        return { label, value: Array.isArray(value) ? value as number[] : [], onChange: onChange as (value: number[]) => void }
      case 'asset':
        return { label, value: value as any, kind: definition.type === 'asset' ? 'asset' : definition.type, onChange: onChange as (value: any) => void }
      case 'object':
        return { label, value: value as any, onChange: onChange as (value: any) => void }
      case 'gradient':
        return { label, value: value as GradientValue, onChange: onChange as (value: GradientValue) => void, onGestureStart, onGestureEnd }
      case 'curve': {
        const curve = value as CurveValue
        return {
          label,
          value: curve,
          min: definition.min,
          max: definition.max,
          onChange: onChange as (value: CurveValue) => void,
          onGestureStart,
          onGestureEnd,
        }
      }
      case 'envelope': {
        const envelope = value as EnvelopeValue
        return { label, value: envelope, scheduler: runtime.scheduler, onChange: onChange as (value: EnvelopeValue) => void }
      }
      case 'waveform':
        return { label, samples: Array.isArray(value) ? value : [] }
      case 'text':
        return { label, value: String(value ?? ''), onChange: onChange as (v: string) => void }
      default:
        return { label, type: definition.type, value }
    }
  }

  return (
    <div ref={ref} className="artinos-parameter-control" data-presentation={chosen?.id} data-density={density} inert={definition.presentation?.readOnly || undefined} aria-disabled={definition.presentation?.readOnly || undefined}>
      <ComponentRenderer
        node={{
          component: chosen?.component ?? 'unsupported-control',
          parameter: definition.id,
          presentation: chosen?.id,
          state: { status: status ?? 'idle', disabled: definition.presentation?.readOnly ?? false },
          props: componentProps(),
        }}
        registry={controls}
      />
    </div>
  )
}
