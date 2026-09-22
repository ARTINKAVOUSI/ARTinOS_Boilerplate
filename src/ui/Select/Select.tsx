import type { CSSProperties } from 'react'
import './Select.css'

export type SelectOption<T extends string = string> = T | { value: T; label: string; disabled?: boolean }

export interface SelectProps<T extends string = string> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  /** Accessible name. */
  label: string
  id?: string
  disabled?: boolean
  size?: 'md' | 'sm'
  className?: string
  style?: CSSProperties
}

const words = (value: string) => value.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase())

/**
 * Select — a native <select> dressed as a capsule. Native keeps keyboard,
 * type-ahead and mobile pickers working for free. Plain string options are
 * shown in sentence case.
 */
export function Select<T extends string = string>({ value, options, onChange, label, id, disabled = false, size = 'md', className, style }: SelectProps<T>) {
  return (
    <span className={className ? `aui-select ${className}` : 'aui-select'} data-size={size === 'sm' ? 'sm' : undefined} style={style}>
      <select id={id} value={value} disabled={disabled} aria-label={label} onChange={event => onChange(event.target.value as T)}>
        {options.map(option => {
          const item = typeof option === 'string' ? { value: option, label: words(option), disabled: false } : option
          return (
            <option key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </option>
          )
        })}
      </select>
      <svg className="aui-select__chevron" viewBox="0 0 10 10" aria-hidden>
        <path d="M2.5 4l2.5 2.5L7.5 4" />
      </svg>
    </span>
  )
}

export default Select
