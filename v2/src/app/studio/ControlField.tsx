import { useEffect, useState } from 'react'
import type { Control, ControlValue } from '../feature'
import { Slider } from '../../ui/Slider/Slider'
import { Field } from '../../ui/Field/Field'
import { Toggle } from '../../ui/Toggle/Toggle'
import { Select } from '../../ui/Select/Select'
import { ColorField } from '../../ui/ColorField/ColorField'
import { VectorField } from '../../ui/VectorField/VectorField'
import { TextField } from '../../ui/TextField/TextField'

export const labelOf = (key: string, control: Control) =>
  control.label ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

/** Text commits on Enter or blur, so URL fields do not reload on every keystroke. */
function CommitText({ value, label, placeholder, onChange }: { value: string; label: string; placeholder?: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => draft !== value && onChange(draft)
  return (
    <TextField
      value={draft}
      label={label}
      placeholder={placeholder}
      spellCheck={false}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') setDraft(value)
      }}
    />
  )
}

/** Maps one control schema entry to the matching UI component. */
export function ControlField({ name, control, value, onChange }: { name: string; control: Control; value: ControlValue | undefined; onChange: (value: ControlValue) => void }) {
  const label = labelOf(name, control)
  switch (control.type) {
    case 'number':
      return (
        <Slider
          label={label}
          value={typeof value === 'number' ? value : control.value}
          min={control.min}
          max={control.max}
          step={control.step}
          unit={control.unit}
          defaultValue={control.value}
          onChange={onChange}
        />
      )
    case 'boolean':
      return (
        <Field label={label}>
          <Toggle label={label} checked={typeof value === 'boolean' ? value : control.value} onChange={onChange} size="sm" />
        </Field>
      )
    case 'select':
      return (
        <Field label={label}>
          <Select label={label} value={String(value ?? control.value)} options={control.options} onChange={onChange} />
        </Field>
      )
    case 'color':
      return (
        <Field label={label}>
          <ColorField label={label} value={String(value ?? control.value)} onChange={onChange} />
        </Field>
      )
    case 'vector3':
      return (
        <Field label={label}>
          <VectorField label={label} value={(Array.isArray(value) ? value : control.value) as [number, number, number]} step={control.step} onChange={v => onChange([...v] as [number, number, number])} />
        </Field>
      )
    case 'text':
      return (
        <Field label={label}>
          <CommitText label={label} value={String(value ?? control.value)} placeholder={control.placeholder} onChange={onChange} />
        </Field>
      )
  }
}
