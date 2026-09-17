import type { ReactNode } from 'react'
import { Field } from './field'
import { SelectShell } from './choice'
import { NumberWell } from './numeric-input'

export interface SelectionItem {
  id: string
  label: ReactNode
  /** Quiet trailing detail, e.g. "MESH / 01". */
  meta?: ReactNode
}

/** SelectionList — a column of pressable objects, one selected (reference `.selection-list`). */
export function SelectionList({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: SelectionItem[]
  value: string | null
  onChange(id: string): void
}) {
  return (
    <div className="artinos-selection-list" role="group" aria-label={label}>
      {items.map(item => (
        <button key={item.id} type="button" className="artinos-object" aria-pressed={item.id === value} onClick={() => onChange(item.id)}>
          {item.label}
          {item.meta !== undefined && <span>{item.meta}</span>}
        </button>
      ))}
    </div>
  )
}

/** PinBar — the pinned parameters as quick links, or a prompt when there are none (reference `.pins`). */
export function PinBar({
  items,
  empty = 'Pin a parameter',
  onSelect,
}: {
  items: Array<{ id: string; label: ReactNode }>
  empty?: ReactNode
  onSelect(id: string): void
}) {
  return (
    <div className="artinos-pins">
      <span aria-hidden="true">◇</span>
      {items.length ? (
        items.map(item => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)}>
            {item.label}
          </button>
        ))
      ) : (
        <span className="artinos-pins-empty">{empty}</span>
      )}
    </div>
  )
}

/** DimensionField — a size and how it is resolved, side by side (reference `.dimension`). */
export function DimensionField<Mode extends string>({
  label,
  value,
  mode,
  modes,
  min = 0,
  step = 1,
  onChange,
  onModeChange,
}: {
  label: string
  value: number
  mode: Mode
  modes: readonly Mode[]
  min?: number
  step?: number
  onChange(value: number): void
  onModeChange(mode: Mode): void
}) {
  return (
    <Field label={label}>
      <div className="artinos-dimension">
        <NumberWell label={label} value={value} min={min} step={step} onChange={onChange} />
        <SelectShell>
          <select aria-label={`${label} sizing`} value={mode} onChange={event => onModeChange(event.target.value as Mode)}>
            {modes.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </SelectShell>
      </div>
    </Field>
  )
}
