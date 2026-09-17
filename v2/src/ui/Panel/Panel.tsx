import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import './Panel.css'

export interface PanelProps {
  title: ReactNode
  /** Quiet line under the title. */
  subtitle?: ReactNode
  /** Controls in the header's right corner (icon buttons). */
  actions?: ReactNode
  /** Corner status light. */
  status?: 'live' | 'modified' | 'warning'
  /** Full-bleed content between header and body — tabs, search. */
  toolbar?: ReactNode
  footer?: ReactNode
  /** Header click folds the body. */
  collapsible?: boolean
  defaultCollapsed?: boolean
  /** Drag the panel by its header. The offset is kept in component state. */
  draggable?: boolean
  /** Body scrolls past this height. */
  maxHeight?: number | string
  width?: number | string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Panel — a floating frosted-glass surface with a title, corner actions and an
 * optional footer. Works on its own; import `ui/theme/theme.css` for worlds.
 */
export function Panel({
  title,
  subtitle,
  actions,
  status,
  toolbar,
  footer,
  collapsible = false,
  defaultCollapsed = false,
  draggable = false,
  maxHeight,
  width,
  className,
  style,
  children,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [offset, setOffset] = useState<[number, number]>([0, 0])
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!draggable || event.button !== 0 || (event.target as HTMLElement).closest('button, input, select, textarea, a')) return
    drag.current = { x: event.clientX, y: event.clientY, ox: offset[0], oy: offset[1], moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 3) return
    d.moved = true
    setOffset([d.ox + dx, d.oy + dy])
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    // A click (no movement) on a draggable header still folds it.
    if (d && !d.moved && collapsible) setCollapsed(value => !value)
  }

  return (
    <section
      className={className ? `aui-panel ${className}` : 'aui-panel'}
      data-collapsed={collapsed || undefined}
      aria-label={typeof title === 'string' ? title : undefined}
      style={{ width, translate: offset[0] || offset[1] ? `${offset[0]}px ${offset[1]}px` : undefined, ...style }}
    >
      <header
        className="aui-panel__head"
        data-draggable={draggable || undefined}
        onPointerDown={draggable ? onPointerDown : undefined}
        onPointerMove={draggable ? onPointerMove : undefined}
        onPointerUp={draggable ? onPointerUp : undefined}
        onClick={collapsible && !draggable ? () => setCollapsed(value => !value) : undefined}
      >
        {collapsible && (
          <button
            type="button"
            className="aui-panel__fold"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={event => {
              event.stopPropagation()
              setCollapsed(value => !value)
            }}
          >
            <svg viewBox="0 0 10 10" aria-hidden>
              <path d="M3 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="aui-panel__titles">
          <h2 className="aui-panel__title">{title}</h2>
          {subtitle != null && <div className="aui-panel__subtitle">{subtitle}</div>}
        </div>
        {(status || actions) && (
          <div className="aui-panel__actions">
            {status && <span className="aui-panel__dot" data-tone={status} aria-hidden />}
            {actions}
          </div>
        )}
      </header>
      {!collapsed && (
        <>
          {toolbar && <div className="aui-panel__toolbar">{toolbar}</div>}
          <div className="aui-panel__body" style={{ maxHeight }}>
            {children}
          </div>
          {footer && <footer className="aui-panel__foot">{footer}</footer>}
        </>
      )}
    </section>
  )
}

export default Panel
