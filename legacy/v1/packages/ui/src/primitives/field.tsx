import type { ReactNode } from 'react'

/**
 * Where a control's name sits relative to the control.
 *
 *   inline  the name lives inside the control — the reference's full capsule (`.mc--full`)
 *   row     the name in a 62px column beside the control (`.mc--row`)
 *   stack   the name above a full-width control — the parameter dock
 */
export type FieldLayout = 'row' | 'inline' | 'stack'

export interface FieldProps {
  label: ReactNode
  /** Associates the name with a labelable control. Omit when `asLabel` wraps it. */
  htmlFor?: string
  /** Id for the name, so a non-native control can point `aria-labelledby` at it. */
  labelId?: string
  layout?: FieldLayout
  /** A trailing marker — the modulation diamond. Adds a 7px column. */
  trailing?: ReactNode
  /**
   * `wide` gives the name a 74px column (`.mc--row.wide`); `fit` lets the name
   * take the row and sits the control at its natural width, as toggles do.
   */
  labelWidth?: 'default' | 'wide' | 'fit'
  /** Render the whole row as a `<label>`, so clicking the name focuses the control. */
  asLabel?: boolean
  className?: string
  children: ReactNode
}

/**
 * Field — the MetaComp row (reference `.mc`): label, surface, value and state
 * designed as one object. Every control that carries a name uses it, so names,
 * surfaces and markers line up down a panel whichever control sits in the row.
 */
export function Field({
  label,
  htmlFor,
  labelId,
  layout = 'row',
  trailing,
  labelWidth = 'default',
  asLabel = false,
  className,
  children,
}: FieldProps) {
  const Root = asLabel ? 'label' : 'div'
  return (
    <Root
      className={className ? `artinos-field ${className}` : 'artinos-field'}
      data-layout={layout === 'row' ? undefined : layout}
      data-label-width={labelWidth === 'default' ? undefined : labelWidth}
      data-trailing={trailing ? '' : undefined}
    >
      {htmlFor && !asLabel ? (
        <label className="artinos-field-label" htmlFor={htmlFor} id={labelId}>
          {label}
        </label>
      ) : (
        <span className="artinos-field-label" id={labelId}>
          {label}
        </span>
      )}
      {children}
      {trailing}
    </Root>
  )
}

/**
 * The modulation marker (reference `.mod`) — the accent as information. A 7px
 * diamond at the end of a row; lit means the parameter is bound to something
 * outside it: automation, a pin, a live source.
 */
export function PinButton({ label, pinned, onChange }: { label: string; pinned: boolean; onChange(pinned: boolean): void }) {
  return <button type="button" className="artinos-pin" aria-label={`Pin ${label}`} aria-pressed={pinned} onClick={() => onChange(!pinned)} />
}
