import { useId, useMemo, useState, type ReactNode } from 'react'
import { filterCollection, useRovingCollection } from '../headless'

export interface RadioOption<T extends string = string> {
  id: T
  label: string
  description?: string
  disabled?: boolean
}

export function RadioGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: RadioOption<T>[]; onChange(value: T): void }) {
  return (
    <fieldset className="artinos-radio-group">
      <legend>{label}</legend>
      {options.map(option => (
        <label key={option.id} data-disabled={option.disabled || undefined}>
          <input type="radio" name={label} value={option.id} checked={value === option.id} disabled={option.disabled} onChange={() => onChange(option.id)} />
          <span>{option.label}{option.description && <small>{option.description}</small>}</span>
        </label>
      ))}
    </fieldset>
  )
}

export interface AccordionItem {
  id: string
  label: string
  content: ReactNode
  disabled?: boolean
}

export function Accordion({ items, multiple = false, defaultOpen = [] }: { items: AccordionItem[]; multiple?: boolean; defaultOpen?: string[] }) {
  const [open, setOpen] = useState(() => new Set(defaultOpen))
  const toggle = (id: string) => setOpen(previous => {
    const next = new Set(multiple ? previous : [])
    if (previous.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  return (
    <div className="artinos-accordion">
      {items.map(item => {
        const expanded = open.has(item.id)
        return (
          <section key={item.id}>
            <button type="button" disabled={item.disabled} aria-expanded={expanded} aria-controls={`accordion-${item.id}`} onClick={() => toggle(item.id)}>{item.label}</button>
            {expanded && <div id={`accordion-${item.id}`}>{item.content}</div>}
          </section>
        )
      })}
    </div>
  )
}

export interface ComboboxOption<T = unknown> {
  id: string
  label: string
  value: T
  disabled?: boolean
}

export function Combobox<T>({ label, value, options, placeholder, onChange }: { label: string; value?: T; options: ComboboxOption<T>[]; placeholder?: string; onChange(value: T): void }) {
  const selected = options.find(option => Object.is(option.value, value))
  const [query, setQuery] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const listId = useId()
  const filtered = useMemo(() => filterCollection(options.map(option => ({ ...option, textValue: option.label })), query), [options, query])
  const collection = useRovingCollection(filtered, {
    onActivate: id => {
      const option = options.find(candidate => candidate.id === id)
      if (option && !option.disabled) { onChange(option.value); setQuery(option.label); setOpen(false) }
    },
  })
  return (
    <label className="artinos-combobox">
      <span>{label}</span>
      <input
        role="combobox"
        value={query}
        placeholder={placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={collection.activeId ? `${listId}-${collection.activeId}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setOpen(true) }}
        onKeyDown={event => collection.onKeyDown(event, collection.activeId ?? filtered[0]?.id ?? '')}
      />
      {open && (
        <div id={listId} role="listbox">
          {filtered.map(option => (
            <button
              key={option.id}
              id={`${listId}-${option.id}`}
              type="button"
              role="option"
              aria-selected={Object.is(option.value, value)}
              disabled={option.disabled}
              tabIndex={-1}
              onPointerDown={event => event.preventDefault()}
              onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false) }}
            >{option.label}</button>
          ))}
        </div>
      )}
    </label>
  )
}
