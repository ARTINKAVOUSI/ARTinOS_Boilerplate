import { useId, useState, type ReactNode } from 'react'
import './Section.css'

export interface SectionProps {
  title: ReactNode
  /** Small count or note after the title. */
  meta?: ReactNode
  /** Controls on the right of the header (a toggle, a reset button). Clicking them does not fold. */
  actions?: ReactNode
  /** Controlled open state. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Dim the body, e.g. when the feature behind it is switched off. */
  muted?: boolean
  className?: string
  children?: ReactNode
}

/** Section — a foldable group of rows inside a panel. */
export function Section({ title, meta, actions, open, defaultOpen = true, onOpenChange, muted = false, className, children }: SectionProps) {
  const bodyId = useId()
  const [local, setLocal] = useState(defaultOpen)
  const isOpen = open ?? local
  const toggle = () => {
    setLocal(!isOpen)
    onOpenChange?.(!isOpen)
  }
  return (
    <div className={className ? `aui-section ${className}` : 'aui-section'} data-open={isOpen || undefined} data-muted={muted || undefined}>
      <div className="aui-section__head">
        <button type="button" className="aui-section__toggle" aria-expanded={isOpen} aria-controls={bodyId} onClick={toggle}>
          <svg viewBox="0 0 10 10" aria-hidden>
            <path d="M3 2l3 3-3 3" />
          </svg>
          <span className="aui-section__title">{title}</span>
          {meta != null && <span className="aui-section__meta">{meta}</span>}
        </button>
        {actions && <div className="aui-section__actions">{actions}</div>}
      </div>
      {isOpen && (
        <div id={bodyId} className="aui-section__body">
          {children}
        </div>
      )}
    </div>
  )
}

export default Section
