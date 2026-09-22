import type { ComponentType, ReactNode } from 'react'

export type Dock = 'left' | 'right' | 'bottom' | 'float'
export type EdgeDock = Exclude<Dock, 'float'>

export type PanelIcon = ComponentType<{ size?: number | string }>

/**
 * One panel, declared once. The same descriptor drives the dock, the rail and the
 * command palette — which is why `keywords` and `description` live here rather than
 * being re-stated in a separate search index.
 */
export interface PanelDefinition {
  id: string
  title: string
  content: ReactNode
  /** Lucide (or any) icon component, shown in the header and the rail. */
  icon?: PanelIcon
  /** One line describing what the panel is for. Surfaced in the palette. */
  description?: string
  /** Extra search terms for the palette. */
  keywords?: string[]
  dock?: Dock
  /** Starting size along the dock axis, in pixels. */
  size?: number
  order?: number
  /** Starts expanded rather than collapsed. */
  open?: boolean
  /** Starts shown rather than hidden. */
  visible?: boolean
  /** Status line along the card foot — source, counts, backend (reference AS.01). */
  footer?: ReactNode
  /** Set `false` to keep the panel out of the rail. */
  rail?: boolean
}

/** Identity helper: gives editors the type and keeps declarations self-documenting. */
export function definePanel(definition: PanelDefinition): PanelDefinition {
  return definition
}

/** Per-panel runtime state. Serialised to `localStorage`, so keep it JSON-safe. */
export interface PanelState {
  dock: Dock
  order: number
  open: boolean
  visible: boolean
  size?: number
  x?: number
  y?: number
  width?: number
  height?: number
}

export type PanelLayout = Record<string, PanelState>
