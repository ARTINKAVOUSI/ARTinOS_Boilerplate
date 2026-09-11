import type { ReactNode } from 'react'
import { controls } from './control-registry'

export type PropertyDensity = 'default' | 'compact' | 'micro' | 'multiline'

export interface PropertyRowProps {
  label: string
  /** The control itself. A scrub cell already carries its own label and value. */
  children: ReactNode
  /** Names the driver when the parameter is externally controlled. */
  binding?: string
  status?: 'bound' | 'warn' | 'fault'
  /** Explains a fault. Faults carry text, never colour alone. */
  message?: string
  unit?: string
  /** Shown only when the value differs from its default. */
  onReset?(): void
  /** Right-hand affordances — automation, modulation, context menu. */
  actions?: ReactNode
  density?: PropertyDensity
  /** Dims the row and blocks its control. */
  disabled?: boolean
  /** Multi-selection with differing values (PRD §40). */
  mixed?: boolean
  visibilityState?: 'visible' | 'advanced' | 'revealed' | 'disabled' | 'conditional'
}

/**
 * PropertyRow — the structural component of the Inspector (PRD §38).
 *
 * Gives label, control, unit, status, reset, automation and context actions one
 * consistent relationship, so a panel never re-invents that arrangement.
 *
 * The row does not own the value; it arranges a control that presents one.
 */
export function PropertyRow({
  label,
  children,
  binding,
  status,
  message,
  unit,
  onReset,
  actions,
  density = 'default',
  disabled = false,
  mixed = false,
  visibilityState = 'visible',
}: PropertyRowProps) {
  const state = status ?? (mixed ? 'warn' : undefined)
  return (
    <div
      className="artinos-property-row"
      data-density={density}
      data-state={state}
      data-disabled={disabled || undefined}
      data-mixed={mixed || undefined}
      data-visibility-state={visibilityState}
    >
      <div className="artinos-property-main">
        <span className="artinos-property-label" title={label}>
          {label}
          {binding && <em className="artinos-property-binding">{binding}</em>}
        </span>
        <div className="artinos-property-control">{children}</div>
        {unit && <span className="artinos-property-unit">{unit}</span>}
        {(onReset || actions) && (
          <div className="artinos-property-actions">
            {onReset && (
              <button
                type="button"
                className="artinos-property-reset"
                onClick={onReset}
                aria-label={`Reset ${label}`}
                title="Reset to default"
              >
                ⟲
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
      {/* State is never colour alone: a fault says what is wrong. */}
      {message && <p className="artinos-property-message">{message}</p>}
      {mixed && !message && <p className="artinos-property-message">Mixed values</p>}
    </div>
  )
}

PropertyRow.meta = controls.require('property-row')

/** Groups rows under a section label, per the reference's panel card. */
export function PropertySection({
  title,
  count,
  children,
}: {
  title: string
  count?: number | string
  children: ReactNode
}) {
  return (
    <section className="artinos-section">
      <div className="artinos-section-title">
        <b>{title}</b>
        {count !== undefined && <small>{count}</small>}
      </div>
      <div className="artinos-stack">{children}</div>
    </section>
  )
}

PropertySection.meta = controls.require('property-section')
