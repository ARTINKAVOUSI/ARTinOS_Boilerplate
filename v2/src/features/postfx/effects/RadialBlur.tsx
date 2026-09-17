import { vec2 } from 'three/tsl'
import { radialBlur } from 'three/addons/tsl/display/radialBlur.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface RadialBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Centre, screen UV. */
  centerX?: number
  /** Centre, screen UV. */
  centerY?: number
  /** Per-sample weight. */
  weight?: number
  /** Weight falloff. */
  decay?: number
  /** Brightness of the streaks. */
  exposure?: number
}

/**
 * Radial Blur — streaks radiating from a screen point (fake light shafts, speed).
 *
 * Mount inside <PostFX>.
 */
export function RadialBlur({ id = 'radial-blur', enabled = true, order = 353, centerX = 0.5, centerY = 0.5, weight = 0.9, decay = 0.95, exposure = 1 }: RadialBlurProps) {
  const centerXU = useUniform(centerX)
  const centerYU = useUniform(centerY)
  const weightU = useUniform(weight)
  const decayU = useUniform(decay)
  const exposureU = useUniform(exposure)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input }) => radialBlur(input, { center: vec2(centerXU, centerYU), weight: weightU, decay: decayU, exposure: exposureU }),
  })
  return null
}

export default RadialBlur

export const feature: Feature = {
  id: 'effect.radial-blur',
  label: 'Radial Blur',
  kind: 'effect',
  category: 'blur',
  cost: 'medium',
  order: 353,
  enabled: false,
  webgpuOnly: true,
  component: RadialBlur,
  controls: {
    centerX: { type: 'number', value: 0.5, min: 0, max: 1, step: 0.01 },
    centerY: { type: 'number', value: 0.5, min: 0, max: 1, step: 0.01 },
    weight: { type: 'number', value: 0.9, min: 0, max: 1, step: 0.01 },
    decay: { type: 'number', value: 0.95, min: 0, max: 1, step: 0.001 },
    exposure: { type: 'number', value: 1, min: 0, max: 10, step: 0.01 },
  },
}
