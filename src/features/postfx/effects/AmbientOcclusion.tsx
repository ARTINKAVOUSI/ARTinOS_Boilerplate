import { mix, vec4 } from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface AmbientOcclusionProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blend of the occlusion. */
  intensity?: number
}

/**
 * Ambient Occlusion — ground-truth AO darkens creases and contact areas.
 *
 * Mount inside <PostFX>.
 */
export function AmbientOcclusion({ id = 'gtao', enabled = true, order = 40, intensity = 1 }: AmbientOcclusionProps) {
  const intensityU = useUniform(intensity)
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['normal'],
    build: ({ input, depth, normal, camera }) => {
      if (!normal) return null
      const occlusion = ao(depth, normal, camera).getTextureNode().r
      return vec4(input.rgb.mul(mix(1, occlusion, intensityU)), input.a)
    },
  })
  return null
}

export default AmbientOcclusion

export const feature: Feature = {
  id: 'effect.gtao',
  label: 'Ambient Occlusion (GTAO)',
  kind: 'effect',
  category: 'screen-space',
  cost: 'high',
  order: 40,
  enabled: false,
  component: AmbientOcclusion,
  controls: {
    intensity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
  },
}
