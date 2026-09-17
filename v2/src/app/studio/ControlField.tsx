import { useEffect, useState } from 'react'
import type { Control, ControlValue } from '../feature'
import { Slider } from '../../ui/Slider/Slider'
import { Toggle } from '../../ui/Toggle/Toggle'
import { Select } from '../../ui/Select/Select'
import { ColorField } from '../../ui/ColorField/ColorField'
import { VectorField } from '../../ui/VectorField/VectorField'
import { TextField } from '../../ui/TextField/TextField'

export const labelOf = (key: string, control: Control) =>
  control.label ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

/** Sliders carry their own name inside the capsule; every other control needs the row label. */
export const namesItself = (control: Control) => control.type === 'number'

/** Text applies on Enter or blur, so URL fields do not reload on every keystroke. */
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

/** The bare control for one schema entry. The row around it supplies the label where needed. */
export function ControlInput({ name, control, value, onChange }: { name: string; control: Control; value: ControlValue | undefined; onChange: (value: ControlValue) => void }) {
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
      return <Toggle label={label} checked={typeof value === 'boolean' ? value : control.value} onChange={onChange} size="sm" />
    case 'select':
      return <Select label={label} value={String(value ?? control.value)} options={control.options} onChange={onChange} />
    case 'color':
      return <ColorField label={label} value={String(value ?? control.value)} onChange={onChange} />
    case 'vector3':
      return (
        <VectorField
          label={label}
          value={(Array.isArray(value) ? value : control.value) as [number, number, number]}
          step={control.step}
          onChange={v => onChange([...v] as [number, number, number])}
        />
      )
    case 'text':
      return <CommitText label={label} value={String(value ?? control.value)} placeholder={control.placeholder} onChange={onChange} />
  }
}
