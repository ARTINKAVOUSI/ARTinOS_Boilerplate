import { useMemo, useState } from 'react'
import { features } from '../registry'
import type { DiscoveredFeature } from '../feature'
import { Panel } from '../../ui/Panel/Panel'
import { TextField } from '../../ui/TextField/TextField'
import { Tabs } from '../../ui/Tabs/Tabs'
import { FeatureSection } from './FeatureSection'

const GROUP_ORDER = ['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground', 'Objects', 'Input', 'Diagnostics']

type Tab = 'scene' | 'input' | 'diagnostics'
const TAB_OF = (feature: DiscoveredFeature): Tab =>
  feature.group === 'Input' ? 'input' : feature.group === 'Diagnostics' ? 'diagnostics' : 'scene'

// Everything except effects and the pipeline host, which live in the PostFX panel.
const panelFeatures = features.filter(feature => feature.kind !== 'effect' && feature.id !== 'postfx')

/** The left panel: every scene, input and diagnostic feature, grouped and searchable. */
export function ScenePanel({ onClose }: { onClose?: () => void }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('scene')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = panelFeatures.filter(feature =>
      q
        ? `${feature.label} ${feature.group ?? ''} ${Object.keys(feature.controls ?? {}).join(' ')}`.toLowerCase().includes(q)
        : TAB_OF(feature) === tab,
    )
    const map = new Map<string, DiscoveredFeature[]>()
    for (const feature of visible) {
      const group = feature.group ?? 'Other'
      map.set(group, [...(map.get(group) ?? []), feature])
    }
    return [...map.entries()].sort(([a], [b]) => (GROUP_ORDER.indexOf(a) + 99) % 99 - (GROUP_ORDER.indexOf(b) + 99) % 99)
  }, [query, tab])

  const count = (t: Tab) => panelFeatures.filter(feature => TAB_OF(feature) === t).length

  return (
    <Panel
      title="Scene"
      subtitle={`${panelFeatures.length} features · src/features`}
      className="studio-panel"
      status="live"
      actions={onClose && <button type="button" className="studio-close" aria-label="Close scene panel" onClick={onClose}>×</button>}
      toolbar={
        <div className="studio-toolbar-stack">
          <TextField type="search" value={query} onChange={setQuery} label="Search features and settings" placeholder="Search…" size="sm" />
          {!query && (
            <Tabs
              label="Feature groups"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'scene', label: 'Scene', badge: count('scene') },
                { value: 'input', label: 'Input', badge: count('input') },
                { value: 'diagnostics', label: 'Diagnostics', badge: count('diagnostics') },
              ]}
            />
          )}
        </div>
      }
    >
      {groups.length === 0 && <div className="studio-note">Nothing matches “{query}”.</div>}
      {groups.map(([group, list]) => (
        <div key={group} className="studio-group">
          <div className="studio-group__title">{group}</div>
          {list.map(feature => (
            <FeatureSection key={feature.id} feature={feature} defaultOpen={Boolean(query)} />
          ))}
        </div>
      ))}
    </Panel>
  )
}
