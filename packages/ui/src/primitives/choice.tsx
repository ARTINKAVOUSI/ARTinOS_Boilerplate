import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { runSpring } from '../react/use-spring'
import { controls } from './control-registry'
import { Field } from './field'

export interface Option {
  label: string
  value: string | number | boolean | null
}

// Layout effects place a travelling part before paint; the same components also
// render on a server in tests, where that effect only produces a warning.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Carries a CSS number to `target` on the world's spring, starting from wherever
 * it currently is, so a re-target mid-travel continues instead of jumping.
 *
 * The number is written straight to the element and is never part of React's
 * style prop — a re-render would otherwise snap it back to the target mid-flight.
 */
function useSpringVar<T extends HTMLElement>(name: string, target: number): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const position = useRef(target)
  const cancel = useRef<() => void>(() => {})

  useIsomorphicLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (position.current === target) {
      element.style.setProperty(name, String(target))
      return
    }
    cancel.current()
    cancel.current = runSpring(element, position.current, target, value => {
      position.current = value
      element.style.setProperty(name, value.toFixed(4))
    })
  }, [name, target])

  useEffect(() => () => cancel.current(), [])
  return ref
}

/**
 * Toggle — reference `.tgl`. An active knob travels a recessed well on the
 * world's spring; its seam tick takes the signal when on. It is a real
 * `role="switch"` button, so keyboard, focus and screen readers need nothing extra.
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
  const track = useSpringVar<HTMLButtonElement>('--switch-t', value ? 1 : 0)
  return (
    <Field label={label} labelWidth="fit" className="artinos-toggle-field">
      <button
        ref={track}
        type="button"
        role="switch"
        className="artinos-switch"
        aria-checked={value}
        aria-label={label}
        title={description}
        disabled={disabled}
        onClick={() => onChange(!value)}
      >
        <span className="artinos-switch-knob" aria-hidden />
      </button>
    </Field>
  )
}

/**
 * Checkbox — the inline-flag idiom ("Denoise · Motion blur · GPU"): a small well
 * that takes the active material when checked, with the label beside it.
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
      <i aria-hidden />
      <span>{label}</span>
    </label>
  )
}

/** The chevron the reference draws on every select. */
function Chevron() {
  return (
    <svg className="artinos-select-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * The select body (reference `.select`): a raised surface around a native
 * `<select>`, with the chevron. Use it for any select that sits outside a row.
 */
export function SelectShell({ children }: { children: ReactNode }) {
  return (
    <span className="artinos-select">
      {children}
      <Chevron />
    </span>
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
    <Field asLabel label={label}>
      <SelectShell>
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
      </SelectShell>
    </Field>
  )
}

/**
 * Segmented — reference `.seg`. The active segment rises from the frost as one
 * insert that slides to the option you pick, on the world's spring: quick in
 * Clear, slow and heavy in Monolith.
 */
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
  const normalized = options.map(item => (typeof item === 'string' ? { label: item, value: item } : item))
  const index = normalized.findIndex(option => String(value) === String(option.value))
  const group = useSpringVar<HTMLDivElement>('--seg-pos', Math.max(0, index))
  const control = (
    <div
      ref={group}
      className="artinos-segmented"
      role="group"
      aria-label={label}
      style={{ '--seg-index': Math.max(0, index), '--seg-count': normalized.length } as CSSProperties}
    >
      {index >= 0 && normalized.length > 1 && <span className="artinos-segmented-thumb" aria-hidden />}
      {normalized.map(option => {
        const selected = String(value) === String(option.value)
        return (
          <button type="button" key={String(option.value)} aria-pressed={selected} className={selected ? 'is-active' : undefined} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
  return label ? <Field label={label}>{control}</Field> : control
}

/** Tabs — reference `.tabs`: quiet text on a shared rule; the selected tab carries a 1.5px signal underline. */
export function Tabs({
  value,
  items,
  label,
  onChange,
}: {
  value: string
  items: Array<{ id: string; label: string }>
  label?: string
  onChange(value: string): void
}) {
  return (
    <div className="artinos-tabs" role="tablist" aria-label={label}>
      {items.map(item => (
        <button
          type="button"
          key={item.id}
          role="tab"
          tabIndex={value === item.id ? 0 : -1}
          aria-selected={value === item.id}
          className={value === item.id ? 'is-active' : undefined}
          onClick={() => onChange(item.id)}
          onKeyDown={event => {
            const index = items.findIndex(entry => entry.id === item.id)
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % items.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + items.length) % items.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : -1
            if (next < 0) return
            event.preventDefault()
            onChange(items[next].id)
            ;(event.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined)?.focus()
          }}
        >
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
