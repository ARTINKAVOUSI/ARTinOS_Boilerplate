import { blendColor, convertToTexture } from 'three/tsl'
import { ssr } from 'three/addons/tsl/display/SSRNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface SSRProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** GGX rays for rough surfaces; noisier. */
  stochastic?: boolean
  /** Refine hits for accuracy. */
  binaryRefine?: boolean
  /** Reflect dielectrics too. */
  reflectNonMetals?: boolean
}

/**
 * Screen-Space Reflections — reflects what is already on screen onto glossy surfaces.
 *
 * Mount inside <PostFX>.
 */
export function SSR({ id = 'ssr', enabled = true, order = 20, stochastic = false, binaryRefine = true, reflectNonMetals = true }: SSRProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['normal', 'metalRoughness'],
    webgpuOnly: true,
    build: ({ input, depth, normal, metalRoughness, camera }) => (normal && metalRoughness ? blendColor(input, ssr(convertToTexture(input), depth, normal, { camera, stochastic, binaryRefine, reflectNonMetals, metalnessNode: metalRoughness.r, roughnessNode: metalRoughness.g })) : null),
  }, [stochastic, binaryRefine, reflectNonMetals])
  return null
}

export default SSR

export const feature: Feature = {
  id: 'effect.ssr',
  label: 'Screen-Space Reflections',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 20,
  enabled: false,
  webgpuOnly: true,
  component: SSR,
  controls: {
    stochastic: { type: 'boolean', value: false },
    binaryRefine: { type: 'boolean', value: true },
    reflectNonMetals: { type: 'boolean', value: true },
  },
}
