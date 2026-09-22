import type { DirectionalLight } from 'three/webgpu'
import { mix, vec4 } from 'three/tsl'
import { sss } from 'three/addons/tsl/display/SSSNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform, findLight } from '../PostFX'

export interface ScreenSpaceShadowsProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Shadow darkness. */
  intensity?: number
  /** Longest shadow, world units. */
  maxDistance?: number
  /** The main light. */
  light?: DirectionalLight
}

/**
 * Screen-Space Shadows — fine contact shadows from the main directional light.
 *
 * Pass `light`, or the first shadow-casting directional light is used.
 *
 * Mount inside <PostFX>.
 */
export function ScreenSpaceShadows({ id = 'sss', enabled = true, order = 45, intensity = 1, maxDistance = 0.1, light }: ScreenSpaceShadowsProps) {
  const intensityU = useUniform(intensity)
  const maxDistanceU = useUniform(maxDistance)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input, depth, camera, scene }) => {
      const source = light ?? (findLight(scene, object => !!(object as DirectionalLight).isDirectionalLight) as DirectionalLight | undefined)
      if (!source) return null
      const node = sss(depth, camera, source)
      node.maxDistance = maxDistanceU
      const shadow = node.getTextureNode().r
      return vec4(input.rgb.mul(mix(1, shadow, intensityU)), input.a)
    },
  }, [light])
  return null
}

export default ScreenSpaceShadows

export const feature: Feature = {
  id: 'effect.sss',
  label: 'Screen-Space Shadows',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 45,
  enabled: false,
  webgpuOnly: true,
  component: ScreenSpaceShadows,
  controls: {
    intensity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
    maxDistance: { type: 'number', value: 0.1, min: 0.01, max: 1, step: 0.01 },
  },
}
