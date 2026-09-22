import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  /** Leading icon. */
  icon?: ReactNode
  /** Right-aligned hint, e.g. a shortcut. */
  trailing?: ReactNode
  /** Stretch to the container width. */
  block?: boolean
}

/** Button — a labelled action. `primary` is the one main action in a view. */
export function Button({ variant = 'default', size = 'md', icon, trailing, block = false, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `aui-button ${className}` : 'aui-button'}
      data-variant={variant === 'default' ? undefined : variant}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-block={block || undefined}
      {...rest}
    >
      {icon && <span className="aui-button__icon">{icon}</span>}
      {children != null && <span className="aui-button__label">{children}</span>}
      {trailing && <span className="aui-button__trailing">{trailing}</span>}
    </button>
  )
}

export default Button
