import type { CSSProperties, ReactNode } from 'react'
import './Toolbar.css'

export interface ToolbarProps {
  /** Accessible name. */
  label: string
  orientation?: 'horizontal' | 'vertical'
  /** Frosted floating surface (for toolbars over the canvas). */
  floating?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/** Toolbar — a row (or column) of buttons. Use <ToolbarSeparator/> between groups. */
export function Toolbar({ label, orientation = 'horizontal', floating = false, className, style, children }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={orientation}
      className={className ? `aui-toolbar ${className}` : 'aui-toolbar'}
      data-floating={floating || undefined}
      style={style}
    >
      {children}
    </div>
  )
}

export function ToolbarSeparator() {
  return <span className="aui-toolbar__separator" role="separator" />
}

/** Stretches to push the following items to the far end. */
export function ToolbarSpacer() {
  return <span className="aui-toolbar__spacer" />
}

export default Toolbar
