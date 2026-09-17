import type { ReactNode } from 'react'
import './Field.css'

export interface FieldProps {
  label: ReactNode
  /** Associates the label with a native control. */
  htmlFor?: string
  /** `row`: label column beside the control. `stack`: label above it. */
  layout?: 'row' | 'stack'
  /** Small trailing slot — a reset button, a unit, a modulation marker. */
  trailing?: ReactNode
  /** Quiet help line under the control. */
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** Field — a labelled row so every control lines up down a panel. */
export function Field({ label, htmlFor, layout = 'row', trailing, hint, className, children }: FieldProps) {
  return (
    <div className={className ? `aui-field ${className}` : 'aui-field'} data-layout={layout}>
      {htmlFor ? (
        <label className="aui-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="aui-field__label">{label}</span>
      )}
      <div className="aui-field__control">{children}</div>
      {trailing && <div className="aui-field__trailing">{trailing}</div>}
      {hint && <div className="aui-field__hint">{hint}</div>}
    </div>
  )
}

export default Field
