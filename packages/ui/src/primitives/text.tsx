import type { ChangeEvent, Ref } from 'react'
import { controls } from './control-registry'
import { Field } from './field'

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
    <Field asLabel label={label}>
      <input className="artinos-text" value={value} placeholder={placeholder} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} />
    </Field>
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

/** Search — a recessed field with a lens glyph and an optional shortcut hint (reference `.search`). */
export function SearchField({
  value,
  placeholder = 'Search…',
  label,
  shortcut,
  inputRef,
  onChange,
}: {
  value: string
  placeholder?: string
  /** Accessible name. Defaults to the placeholder. */
  label?: string
  /** Rendered as a key hint at the right edge, e.g. "/". */
  shortcut?: string
  inputRef?: Ref<HTMLInputElement>
  onChange(value: string): void
}) {
  return (
    <label className="artinos-search">
      <span aria-hidden="true">⌕</span>
      <input ref={inputRef} type="search" aria-label={label ?? placeholder} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      {shortcut && <kbd>{shortcut}</kbd>}
    </label>
  )
}

TextField.meta = controls.require('text-field')
TextArea.meta = controls.require('text-area')
SearchField.meta = controls.require('search-field')
