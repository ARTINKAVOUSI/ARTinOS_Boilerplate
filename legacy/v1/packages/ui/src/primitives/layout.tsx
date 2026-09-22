import type { PropsWithChildren } from 'react'
import { controls } from './control-registry'

export function Section({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <div className="artinos-section">
      <div className="artinos-section-title">
        <b>{title}</b>
        {description && <small>{description}</small>}
      </div>
      {children}
    </div>
  )
}

export function Stack({ children }: PropsWithChildren) {
  return <div className="artinos-stack">{children}</div>
}

/** A row of actions. `fill` shares the width equally, as the workbench's transform tools do. */
export function Toolbar({ children, fill = false }: PropsWithChildren<{ fill?: boolean }>) {
  return (
    <div className="artinos-toolbar" data-fill={fill || undefined}>
      {children}
    </div>
  )
}

export function Empty({ children }: PropsWithChildren) {
  return <p className="artinos-empty">{children}</p>
}

/** Quiet explanatory text between controls (reference `.appearance-note`). */
export function Note({ children }: PropsWithChildren) {
  return <p className="artinos-note">{children}</p>
}

/** The latest edit, announced politely (reference `.change-log`). */
export function ChangeLog({ children }: PropsWithChildren) {
  return (
    <div className="artinos-log" aria-live="polite">
      {children}
    </div>
  )
}

Section.meta = controls.require('section')
Stack.meta = controls.require('stack')
Toolbar.meta = controls.require('toolbar')
