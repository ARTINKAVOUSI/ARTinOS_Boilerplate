import type { PerspectiveCamera } from 'three/webgpu'
import { vec4 } from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface SSGIProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Directions sampled per pixel. */
  sliceCount?: number
  /** Steps per direction. */
  stepCount?: number
  /** Bounce light strength. */
  intensity?: number
}

/**
 * SSGI — screen-space bounce light and ambient occlusion.
 *
 * Mount inside <PostFX>.
 */
export function SSGI({ id = 'ssgi', enabled = true, order = 30, sliceCount = 2, stepCount = 8, intensity = 1 }: SSGIProps) {
  const sliceCountU = useUniform(sliceCount)
  const stepCountU = useUniform(stepCount)
  const intensityU = useUniform(intensity)
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['normal', 'diffuse'],
    webgpuOnly: true,
    build: ({ input, depth, normal, diffuse, camera }) => {
      if (!normal || !diffuse) return null
      const node = ssgi(input, depth, normal, camera as PerspectiveCamera)
      node.sliceCount = sliceCountU
      node.stepCount = stepCountU
      // Since r185 the node renders two textures: AO (one channel, in .r) and
      // GI (rgb). The node itself stands for the AO texture, so reading its
      // .rgb / .a gives (ao, 0, 0) and 1 — a red wash and no occlusion.
      const ao = node.getAONode().r
      const gi = node.getGINode().rgb
      // As three.js composites it: occlusion darkens the lit image, and bounce
      // light lands on the surface's albedo, not on the already-lit colour.
      return vec4(input.rgb.mul(ao).add(diffuse.rgb.mul(gi).mul(intensityU)), input.a)
    },
  })
  return null
}

export default SSGI

export const feature: Feature = {
  id: 'effect.ssgi',
  label: 'Global Illumination (SSGI)',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 30,
  // On by default: the default stage is lit to be seen through it.
  enabled: true,
  webgpuOnly: true,
  description: 'Screen-space bounce light and ambient occlusion',
  component: SSGI,
  controls: {
    sliceCount: { type: 'number', value: 2, min: 1, max: 4, step: 1 },
    stepCount: { type: 'number', value: 8, min: 4, max: 24, step: 1 },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
  },
}
