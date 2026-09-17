import type { ComponentType } from 'react'

/**
 * The panel contract.
 *
 * A studio panel is one file under `src/panels/` that exports a component and a
 * `panel` manifest. The dock discovers every manifest and gives each panel a tab
 * in the MetaBlock dock. Delete the file and the tab is gone; paste one in and
 * it appears. Panels can be dragged out, floated, split, re-docked and merged —
 * that is the dock's job, not the panel's.
 */
export interface PanelManifest {
  /** Unique, stable. The saved layout is keyed by it. */
  id: string
  title: string
  /** One line: what the panel is for. Shown as the tab tooltip and in the palette. */
  description?: string
  /** Extra search words for the command palette. */
  keywords?: string[]
  /** Tab order, lower first. */
  order?: number
  /** Starting place. Every panel shares the bottom dock unless it says otherwise. */
  dock?: 'bottom' | 'left' | 'right' | 'float'
  /** The tab that is active on first launch. */
  active?: boolean
  /** Quiet status line along the pane foot. */
  footer?: ComponentType
  component: ComponentType
}

export interface DiscoveredPanel extends PanelManifest {
  path: string
}

const modules = import.meta.glob<{ panel?: PanelManifest }>('../panels/*.tsx', { eager: true })

function discover(): DiscoveredPanel[] {
  const seen = new Set<string>()
  const found: DiscoveredPanel[] = []
  for (const [path, module] of Object.entries(modules)) {
    const panel = module.panel
    if (!panel) continue
    const file = path.replace('../', 'src/')
    if (!panel.id || !panel.title || typeof panel.component !== 'function') {
      console.warn(`[panels] ${file} exports an incomplete panel manifest and was skipped.`)
      continue
    }
    if (seen.has(panel.id)) {
      console.warn(`[panels] Duplicate panel id "${panel.id}" in ${file}; skipped.`)
      continue
    }
    seen.add(panel.id)
    found.push({ ...panel, path: file })
  }
  return found.sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
}

export const panels = discover()
