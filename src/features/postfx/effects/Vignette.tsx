import { vec4 } from 'three/tsl'
import { vignette } from 'three/addons/tsl/display/CRT.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface VignetteProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Darkening amount. */
  intensity?: number
  /** Edge softness. */
  smoothness?: number
}

/**
 * Vignette — darkens the frame towards its corners.
 *
 * Mount inside <PostFX>.
 */
export function Vignette({ id = 'vignette', enabled = true, order = 700, intensity = 0.35, smoothness = 0.55 }: VignetteProps) {
  const intensityU = useUniform(intensity)
  const smoothnessU = useUniform(smoothness)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(vignette(input.rgb, intensityU, smoothnessU), input.a) })
  return null
}

export default Vignette

export const feature: Feature = {
  id: 'effect.vignette',
  label: 'Vignette',
  kind: 'effect',
  category: 'lens',
  cost: 'low',
  order: 700,
  enabled: true,
  component: Vignette,
  controls: {
    intensity: { type: 'number', value: 0.35, min: 0, max: 1, step: 0.01 },
    smoothness: { type: 'number', value: 0.55, min: 0, max: 1, step: 0.01 },
  },
}
