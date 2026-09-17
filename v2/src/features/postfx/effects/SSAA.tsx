import { ssaaPass } from 'three/addons/tsl/display/SSAAPassNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface SSAAProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Samples = 2^level. */
  sampleLevel?: number
}

/**
 * SSAA — supersampled anti-aliasing. Re-renders the scene several times per frame,
 * so it replaces the scene pass and ignores effects ordered before it.
 *
 * Mount inside <PostFX>.
 */
export function SSAA({ id = 'ssaa', enabled = true, order = 10, sampleLevel = 2 }: SSAAProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ scene, camera }) => {
      const node = ssaaPass(scene, camera)
      node.sampleLevel = sampleLevel
      return node.getTextureNode()
    },
  }, [sampleLevel])
  return null
}

export default SSAA

export const feature: Feature = {
  id: 'effect.ssaa',
  label: 'SSAA',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'very-high',
  order: 10,
  enabled: false,
  webgpuOnly: true,
  component: SSAA,
  controls: {
    sampleLevel: { type: 'number', value: 2, min: 0, max: 5, step: 1 },
  },
}
