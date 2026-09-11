export interface Option {
  label: string
  value: string | number | boolean | null
}

/**
 * Toggle — recessed track, square knob (reference PL.05).
 *
 * Carries an explicit ON/OFF caption because state is never colour alone. The
 * native checkbox stays the interactive element, so keyboard, focus and screen
 * readers work without re-implementation.
 */
export function Toggle({
  label,
  value,
  description,
  disabled = false,
  onChange,
}: {
  label: string
  value: boolean
  description?: string
  disabled?: boolean
  onChange(value: boolean): void
}) {
  return (
    <label
      className="artinos-control artinos-toggle"
      data-state={disabled ? 'disabled' : value ? 'checked' : 'default'}
      data-disabled={disabled || undefined}
    >
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <i />
      <em className="artinos-toggle-state" aria-hidden>
        {value ? 'ON' : 'OFF'}
      </em>
    </label>
  )
}

/**
 * Checkbox — 14px square, recessed well (reference PL.05).
 *
 * Distinct from `Toggle`: this is the inline-flag idiom (a row of "Denoise ·
 * Motion blur · GPU" checks), not a standalone on/off control, so it carries
 * no ON/OFF caption of its own — the label is the state.
 */
export function Checkbox({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: boolean
  disabled?: boolean
  onChange(value: boolean): void
}) {
  return (
    <label className="artinos-checkbox" data-disabled={disabled || undefined}>
      <input type="checkbox" checked={value} disabled={disabled} onChange={event => onChange(event.target.checked)} />
      <i />
      <span>{label}</span>
    </label>
  )
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | number | boolean | null
  options: Array<string | Option>
  // Callers narrow the option type themselves; a union here would force a cast at
  // every string-only call site, which is the common case.
  onChange(value: any): void
}) {
  const normalized = options.map(option => (typeof option === 'string' ? { label: option, value: option } : option))
  return (
    <label className="artinos-control">
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={event => {
          // Option values may be non-strings; map the DOM value back to the real one.
          const found = normalized.find(option => String(option.value) === event.target.value)
          onChange(found ? found.value : event.target.value)
        }}
      >
        {normalized.map(option => (
          <option key={`${option.label}:${String(option.value)}`} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: string
  options: Array<string | Option>
  onChange(value: any): void
}) {
  return (
    <div className="artinos-segmented-wrap">
      {label && <span>{label}</span>}
      <div className="artinos-segmented" role="group" aria-label={label}>
        {options.map(item => {
          const option = typeof item === 'string' ? { label: item, value: item } : item
          const selected = String(value) === String(option.value)
          return <button type="button" key={String(option.value)} aria-pressed={selected} className={selected ? 'is-active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>
        })}
      </div>
    </div>
  )
}

export function Tabs({
  value,
  items,
  onChange,
}: {
  value: string
  items: Array<{ id: string; label: string }>
  onChange(value: string): void
}) {
  return (
    <div className="artinos-tabs" role="tablist">
      {items.map(item => (
        <button type="button" key={item.id} role="tab" tabIndex={value === item.id ? 0 : -1} aria-selected={value === item.id} className={value === item.id ? 'is-active' : ''} onClick={() => onChange(item.id)} onKeyDown={event => {
          const index = items.findIndex(entry => entry.id === item.id)
          const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1
          if (next < 0) return
          event.preventDefault()
          onChange(items[next].id)
          ;(event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus()
        }}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

Toggle.meta = controls.require('toggle')
Checkbox.meta = controls.require('checkbox')
Select.meta = controls.require('select')
Segmented.meta = controls.require('segmented-control')
Tabs.meta = controls.require('tabs')
import { controls } from './control-registry'
