import { useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { FeatureCard, type ControlFilter } from '../app/studio/FeatureCard'
import { ControlsBar } from '../app/studio/ControlsBar'

const GROUPS = ['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground'] as const
const byGroup = GROUPS.map(group => ({ group, list: features.filter(feature => feature.kind === 'scene' && feature.group === group) })).filter(entry => entry.list.length)

function Scene() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ControlFilter>('all')
  const needle = query.trim().toLowerCase()
  return (
    <div className="artinos-panel-suite">
      <ControlsBar query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} placeholder="Search scene controls" />
      <div className="artinos-parameter-cards">
        {byGroup.flatMap(({ group, list }) => list.map(feature => <FeatureCard key={feature.id} feature={feature} query={needle} filter={filter} caption={group} />))}
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
  footer: () => <>ENVIRONMENT · CAMERA · LIGHTING</>,
  component: Scene,
}
