import { useMemo, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { FeatureCard, type ControlFilter } from '../app/studio/FeatureCard'
import { ControlsBar } from '../app/studio/ControlsBar'

/** Groups other panels own. Everything else is project content and lands here. */
const ELSEWHERE = new Set(['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground', 'Input', 'Diagnostics'])
const projectFeatures = features.filter(feature => feature.kind !== 'effect' && feature.kind !== 'canvas-provider' && !ELSEWHERE.has(feature.group ?? ''))

function Inspector() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ControlFilter>('all')
  const needle = query.trim().toLowerCase()
  const controlCount = useMemo(() => projectFeatures.reduce((sum, feature) => sum + Object.keys(feature.controls ?? {}).length, 0), [])

  return (
    <div className="artinos-panel-suite artinos-inspector-suite">
      <ControlsBar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} placeholder="Search project controls" />
      <div className="artinos-panel-summary">
        <span>
          {projectFeatures.length} OBJECTS · {controlCount} CONTROLS
        </span>
        <span>src/features/objects</span>
      </div>
      {projectFeatures.length === 0 ? (
        <div className="v2-empty">No project features. Add a file under src/features/objects.</div>
      ) : (
        <div className="artinos-parameter-cards">
          {projectFeatures.map(feature => (
            <FeatureCard key={feature.id} feature={feature} query={needle} filter={filter} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Inspector

export const panel: PanelManifest = {
  id: 'inspector',
  title: 'Inspector',
  description: 'Project objects and their controls',
  keywords: ['parameters', 'controls', 'properties', 'objects'],
  order: 0,
  active: true,
  footer: () => <>PROJECT · OBJECTS</>,
  component: Inspector,
}
