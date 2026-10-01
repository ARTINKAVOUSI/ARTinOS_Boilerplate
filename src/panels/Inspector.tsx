import type { PanelManifest } from '../app/panel'
import { features, findFeature, inspectors } from '../app/registry'
import { FeatureCard } from '../app/studio/FeatureCard'
import { CardFlow } from '../app/studio/CardFlow'
import { studio, useStudio, type StudioState } from '../app/store'

/** Groups other panels own. Everything else is project content and lands here. */
const ELSEWHERE = new Set(['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground', 'Input'])
const projectFeatures = features.filter(feature => feature.kind !== 'effect' && feature.kind !== 'canvas-provider' && !ELSEWHERE.has(feature.group ?? ''))

const selectFeatures = (state: StudioState) => state.features

function Inspector() {
  // Sections feature folders ship for themselves (v1's glass diagnostics), each
  // shown for the first of its features that is switched on.
  const states = useStudio(selectFeatures)
  const sections = inspectors.flatMap(inspector => {
    const target = inspector.features.find(id => findFeature(id) && states[id]?.enabled)
    return target ? [{ inspector, target }] : []
  })

  return (
    <div className="artinos-panel-suite artinos-inspector-suite">
      {sections.map(({ inspector, target }) => (
          <inspector.component
            key={inspector.id}
            featureId={target}
            values={states[target]?.values ?? {}}
            peer={id => (findFeature(id) ? { enabled: !!states[id]?.enabled } : undefined)}
            setEnabled={(id, enabled) => studio.setEnabled(id, enabled)}
          />
        ))}
      {projectFeatures.length === 0 ? (
        <div className="v2-empty">
          <b>No project objects</b>Add a file under src/features/objects that exports a feature manifest and it appears here.
        </div>
      ) : (
        <CardFlow>
          {projectFeatures.map(feature => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </CardFlow>
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
