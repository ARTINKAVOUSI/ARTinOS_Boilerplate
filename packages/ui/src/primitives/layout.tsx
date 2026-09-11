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

export function Toolbar({ children }: PropsWithChildren) {
  return <div className="artinos-toolbar">{children}</div>
}

export function Empty({ children }: PropsWithChildren) {
  return <div className="artinos-empty">{children}</div>
}

Section.meta = controls.require('section')
Stack.meta = controls.require('stack')
Toolbar.meta = controls.require('toolbar')
