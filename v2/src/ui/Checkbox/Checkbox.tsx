import { useEffect, useRef, type ReactNode } from 'react'
import './Checkbox.css'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible text beside the box. */
  children?: ReactNode
  /** Accessible name when there is no visible text. */
  label?: string
  /** Mixed state, e.g. "some of the group". */
  indeterminate?: boolean
  disabled?: boolean
  className?: string
}

/** Checkbox — a native checkbox with the kit's look. */
export function Checkbox({ checked, onChange, children, label, indeterminate = false, disabled = false, className }: CheckboxProps) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label className={className ? `aui-checkbox ${className}` : 'aui-checkbox'} data-disabled={disabled || undefined}>
      <input
        ref={input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={children ? undefined : label}
        onChange={event => onChange(event.target.checked)}
      />
      <span className="aui-checkbox__box" aria-hidden>
        <svg viewBox="0 0 12 12">
          {indeterminate ? <path d="M3 6h6" /> : <path d="M2.5 6.2l2.3 2.3 4.7-5" />}
        </svg>
      </span>
      {children && <span className="aui-checkbox__text">{children}</span>}
    </label>
  )
}

export default Checkbox
