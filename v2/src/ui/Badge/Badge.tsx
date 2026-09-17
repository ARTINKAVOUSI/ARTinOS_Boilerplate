import type { ReactNode } from 'react'
import './Badge.css'

export interface BadgeProps {
  children: ReactNode
  tone?: 'neutral' | 'live' | 'warm' | 'danger'
  /** Leading status dot. */
  dot?: boolean
  className?: string
  title?: string
}

/** Badge — a small status or count label. */
export function Badge({ children, tone = 'neutral', dot = false, className, title }: BadgeProps) {
  return (
    <span className={className ? `aui-badge ${className}` : 'aui-badge'} data-tone={tone} title={title}>
      {dot && <span className="aui-badge__dot" aria-hidden />}
      {children}
    </span>
  )
}

export default Badge
