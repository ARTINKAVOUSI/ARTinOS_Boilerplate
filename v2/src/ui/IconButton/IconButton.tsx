import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.css'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: an icon button has no visible text. Also shown as the tooltip. */
  label: string
  icon: ReactNode
  /** Pressed/selected look, for toggles in a toolbar. */
  active?: boolean
  size?: 'md' | 'sm'
  /** Draw a body behind the icon at rest. */
  filled?: boolean
}

/** IconButton — a square, icon-only action with an accessible name. */
export function IconButton({ label, icon, active, size = 'md', filled = false, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={className ? `aui-icon-button ${className}` : 'aui-icon-button'}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-filled={filled || undefined}
      {...rest}
    >
      {icon}
    </button>
  )
}

export default IconButton
