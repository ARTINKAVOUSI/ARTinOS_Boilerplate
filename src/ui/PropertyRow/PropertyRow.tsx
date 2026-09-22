import type { ReactNode } from 'react'
import './PropertyRow.css'

export type PropertyDensity = 'default' | 'compact' | 'multiline'

export interface PropertyRowProps {
  label: string
  /** The control. In `default` density it names itself (a slider capsule), so the row label is hidden. */
  children: ReactNode
  /** Names the driver when the value is externally controlled. */
  binding?: string
  status?: 'bound' | 'warn' | 'fault'
  /** Explains a fault in words, never colour alone. */
  message?: string
  /** Shown only when the value differs from its default. */
  onReset?: () => void
  /** Right-hand affordances, shown on hover or focus. */
  actions?: ReactNode
  /** `compact` shows the label in a column beside the control. */
  density?: PropertyDensity
  /** Marks the row as the target of a search reveal. */
  highlighted?: boolean
  /** Written as `data-control`, so a search result can find and scroll to this row. */
  dataControl?: string
  disabled?: boolean
}

/**
 * PropertyRow — the Inspector's structural row: label, control, reset and
 * actions in one consistent arrangement. The row never owns the value.
 */
export function PropertyRow({ label, children, binding, status, message, onReset, actions, density = 'default', highlighted = false, dataControl, disabled = false }: PropertyRowProps) {
  return (
    <div className="aui-prop" data-density={density} data-state={status} data-control={dataControl} data-highlighted={highlighted || undefined} data-disabled={disabled || undefined}>
      <div className="aui-prop__main">
        <span className="aui-prop__label" title={label}>
          {label}
          {binding && <em className="aui-prop__binding">{binding}</em>}
        </span>
        <div className="aui-prop__control">{children}</div>
        {(onReset || actions) && (
          <div className="aui-prop__actions">
            {onReset && (
              <button type="button" className="aui-prop__reset" onClick={onReset} aria-label={`Reset ${label}`} title="Reset to default">
                ⟲
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
      {message && <p className="aui-prop__message">{message}</p>}
    </div>
  )
}

export default PropertyRow
