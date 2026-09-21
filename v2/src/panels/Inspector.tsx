import { useMemo, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { FeatureCard, type ControlFilter } from '../app/studio/FeatureCard'
import { ControlsBar } from '../app/studio/ControlsBar'
import { GlassInspector, activeGlassFeature } from '../app/studio/GlassInspector'
import { useStudio, type StudioState } from '../app/store'

/** Groups other panels own. Everything else is project content and lands here. */
const ELSEWHERE = new Set(['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground', 'Input', 'Diagnostics'])
const projectFeatures = features.filter(feature => feature.kind !== 'effect' && feature.kind !== 'canvas-provider' && !ELSEWHERE.has(feature.group ?? ''))

const selectFeatures = (state: StudioState) => state.features

function Inspector() {
  const [filter, setFilter] = useState<ControlFilter>('all')
  // v1 embedded the glass diagnostics in the Inspector whenever glass was in the scene.
  const glass = activeGlassFeature(useStudio(selectFeatures))
  const controlCount = useMemo(() => projectFeatures.reduce((sum, feature) => sum + Object.keys(feature.controls ?? {}).length, 0), [])

  return (
    <div className="artinos-panel-suite artinos-inspector-suite">
      <ControlsBar filter={filter} onFilter={setFilter} summary={`${projectFeatures.length} OBJECTS · ${controlCount} CONTROLS · SRC/FEATURES/OBJECTS`} />
      {glass && filter === 'all' && <GlassInspector featureId={glass} />}
      {projectFeatures.length === 0 ? (
        <div className="v2-empty">No project features. Add a file under src/features/objects.</div>
      ) : (
        <div className="artinos-parameter-cards">
          {projectFeatures.map(feature => (
            <FeatureCard key={feature.id} feature={feature} filter={filter} />
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
  owns: feature => projectFeatures.includes(feature),
  footer: () => <>PROJECT · OBJECTS</>,
  component: Inspector,
}
