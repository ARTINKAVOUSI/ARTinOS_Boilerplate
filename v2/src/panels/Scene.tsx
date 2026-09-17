import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { FeatureCard, type ControlFilter } from '../app/studio/FeatureCard'
import { ControlsBar } from '../app/studio/ControlsBar'

const GROUPS = ['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground'] as const
const byGroup = GROUPS.map(group => ({ group, list: features.filter(feature => feature.kind === 'scene' && feature.group === group) })).filter(entry => entry.list.length)
const count = byGroup.reduce((sum, entry) => sum + entry.list.length, 0)

function Scene() {
  const [filter, setFilter] = useState<ControlFilter>('all')
  return (
    <div className="artinos-panel-suite">
      <ControlsBar filter={filter} onFilter={setFilter} summary={`${count} SCENE FEATURES · SRC/FEATURES/SCENE`} />
      <div className="artinos-parameter-cards">
        {byGroup.flatMap(({ group, list }) => list.map(feature => <FeatureCard key={feature.id} feature={feature} filter={filter} caption={group} />))}
      </div>
    </div>
  )
}

export default Scene

export const panel: PanelManifest = {
  id: 'scene',
  title: 'Scene',
  description: 'Environment, camera, lighting, shadows and render settings',
  keywords: ['environment', 'camera', 'lighting', 'shadows', 'render', 'fog', 'sky'],
  order: 1,
  owns: feature => feature.kind === 'scene' && GROUPS.includes((feature.group ?? '') as (typeof GROUPS)[number]),
  footer: () => <>ENVIRONMENT · CAMERA · LIGHTING</>,
  component: Scene,
}
