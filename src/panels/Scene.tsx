import type { PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { FeatureCard } from '../app/studio/FeatureCard'
import { CardFlow } from '../app/studio/CardFlow'

const GROUPS = ['Render', 'Camera', 'Atmosphere', 'Lighting', 'Ground'] as const
const byGroup = GROUPS.map(group => ({ group, list: features.filter(feature => feature.kind === 'scene' && feature.group === group) })).filter(entry => entry.list.length)

/**
 * The scene: every card in one packed flow, ordered render → camera →
 * atmosphere → lighting → ground, each card captioned with its group. One flow
 * rather than a section per group, so a wide dock is filled edge to edge.
 */
function Scene() {
  return (
    <div className="artinos-panel-suite">
      <CardFlow>{byGroup.flatMap(({ group, list }) => list.map(feature => <FeatureCard key={feature.id} feature={feature} caption={group} />))}</CardFlow>
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
