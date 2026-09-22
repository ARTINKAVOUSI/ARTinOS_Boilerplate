import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import './TextField.css'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Accessible name when no visible label is associated. */
  label?: string
  /** Leading icon. `type="search"` gets a magnifier by default. */
  icon?: ReactNode
  /** Shows a clear button while there is text. On by default for search. */
  clearable?: boolean
  size?: 'md' | 'sm'
}

const SearchIcon = (
  <svg viewBox="0 0 16 16" aria-hidden>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

/** TextField — a single-line text input; `type="search"` makes it a search box. Escape clears a search. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { value, onChange, label, icon, clearable, size = 'md', type = 'text', className, onKeyDown, ...rest },
  ref,
) {
  const search = type === 'search'
  const leading = icon ?? (search ? SearchIcon : null)
  const showClear = (clearable ?? search) && value.length > 0
  return (
    <span className={className ? `aui-text ${className}` : 'aui-text'} data-size={size === 'sm' ? 'sm' : undefined}>
      {leading && <span className="aui-text__icon">{leading}</span>}
      <input
        ref={ref}
        type={search ? 'text' : type}
        role={search ? 'searchbox' : undefined}
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (search && event.key === 'Escape' && value) {
            event.stopPropagation()
            onChange('')
          }
          onKeyDown?.(event)
        }}
        {...rest}
      />
      {showClear && (
        <button type="button" className="aui-text__clear" aria-label="Clear" onClick={() => onChange('')}>
          <svg viewBox="0 0 10 10" aria-hidden>
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
          </svg>
        </button>
      )}
    </span>
  )
})

export default TextField
