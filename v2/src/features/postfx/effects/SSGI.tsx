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
    needs: ['normal'],
    webgpuOnly: true,
    build: ({ input, depth, normal, camera }) => {
      if (!normal) return null
      const gi = ssgi(input, depth, normal, camera as PerspectiveCamera)
      gi.sliceCount = sliceCountU
      gi.stepCount = stepCountU
      return vec4(input.rgb.mul(gi.a).add(input.rgb.mul(gi.rgb).mul(intensityU)), input.a)
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
  enabled: false,
  webgpuOnly: true,
  component: SSGI,
  controls: {
    sliceCount: { type: 'number', value: 2, min: 1, max: 4, step: 1 },
    stepCount: { type: 'number', value: 8, min: 4, max: 24, step: 1 },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
  },
}
