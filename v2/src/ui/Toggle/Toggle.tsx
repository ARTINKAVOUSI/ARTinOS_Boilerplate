import './Toggle.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name. Visible text belongs in a surrounding Field. */
  label: string
  disabled?: boolean
  size?: 'md' | 'sm'
  className?: string
}

/** Toggle — a switch for an on/off setting that applies immediately. */
export function Toggle({ checked, onChange, label, disabled = false, size = 'md', className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={className ? `aui-toggle ${className}` : 'aui-toggle'}
      data-size={size === 'sm' ? 'sm' : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="aui-toggle__knob" />
    </button>
  )
}

export default Toggle
