import type { ChangeEvent } from 'react'
import { controls } from './control-registry'

export function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange(value: string): void
}) {
  return (
    <label className="artinos-control">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} />
    </label>
  )
}

export function TextArea({
  label,
  value,
  placeholder,
  rows = 4,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  rows?: number
  onChange(value: string): void
}) {
  return (
    <label className="artinos-textarea">
      <span>{label}</span>
      <textarea rows={rows} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

export function SearchField({
  value,
  placeholder = 'Search…',
  onChange,
}: {
  value: string
  placeholder?: string
  onChange(value: string): void
}) {
  return <input className="artinos-search" type="search" aria-label={placeholder} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
}

TextField.meta = controls.require('text-field')
TextArea.meta = controls.require('text-area')
SearchField.meta = controls.require('search-field')
