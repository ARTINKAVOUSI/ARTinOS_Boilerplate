import type { ReactNode } from 'react'

/**
 * Layout presets. The material of every pane now comes from the world it sits
 * in; a variant only changes structure — `dock` lays its rows out in columns,
 * `camera` rules its capsules.
 */
export type PaneVariant = 'default' | 'command' | 'material' | 'light' | 'camera' | 'typography' | 'render' | 'dock'

export interface PaneProps {
  title: ReactNode
  /** Kept for existing callers. The reference panel draws no serial, so it is not rendered. */
  index?: number
  /** The quiet path under the title — "Material / Surface response". */
  meta?: ReactNode
  /** Marks in the top-right corner, after the status dot — icon buttons. */
  actions?: ReactNode
  /** The corner dot: `live` in the signal colour, `modified` in the warm one. */
  status?: 'live' | 'modified'
  /** Full-bleed content between header and body — tabs, search, pins. */
  toolbar?: ReactNode
  footer?: ReactNode
  variant?: PaneVariant
  as?: 'section' | 'aside'
  className?: string
  children?: ReactNode
}

/**
 * Pane — the floating optical surface (reference `.panel`). A lit glass sheet
 * with grain and near-edge luminance; its title, a path under it, and marks in
 * the corner.
 */
export function Pane({ title, meta, actions, status, toolbar, footer, variant = 'default', as: Root = 'section', className, children }: PaneProps) {
  return (
    <Root
      className={className ? `artinos-pane ${className}` : 'artinos-pane'}
      data-variant={variant === 'default' ? undefined : variant}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <header className="artinos-pane-head">
        <h2 className="artinos-pane-title">{title}</h2>
        {meta !== undefined && <div className="artinos-pane-path">{meta}</div>}
        {(status || actions) && (
          <div className="artinos-pane-marks">
            {status && <span className="artinos-dot" data-tone={status === 'modified' ? 'warm' : undefined} aria-hidden />}
            {actions}
          </div>
        )}
      </header>
      {toolbar}
      <div className="artinos-pane-body">{children}</div>
      {footer && <footer className="artinos-pane-foot">{footer}</footer>}
    </Root>
  )
}

/** A footer status (reference `.panel__foot b`): a small dot and a quiet word. */
export function StatusDot({ children, tone = 'live' }: { children: ReactNode; tone?: 'live' | 'modified' }) {
  return (
    <b className="artinos-status-dot">
      <span className="artinos-dot" data-tone={tone === 'modified' ? 'warm' : undefined} aria-hidden />
      {children}
    </b>
  )
}
