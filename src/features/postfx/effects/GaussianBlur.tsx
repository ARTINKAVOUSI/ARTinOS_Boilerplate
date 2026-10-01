import { vec2 } from 'three/tsl'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface GaussianBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Sample spacing. */
  radius?: number
  /** Kernel width, rounded to 0.5 (it is baked into the shader). */
  sigma?: number
}

/**
 * Gaussian Blur — smooth full-frame blur.
 *
 * Mount inside <PostFX>.
 */
export function GaussianBlur({ id = 'gaussian-blur', enabled = true, order = 350, radius = 3, sigma = 2 }: GaussianBlurProps) {
  const radiusU = useUniform(radius)
  // Structural: every new value rebuilds the chain, and a slider drag delivers
  // fractions, so snap to the control's step to rebuild a handful of times.
  const kernel = Math.round(sigma * 2) / 2
  usePostFXEffect(id, { enabled, order, build: ({ input }) => gaussianBlur(input, vec2(radiusU, radiusU), kernel) }, [kernel])
  return null
}

export default GaussianBlur

export const feature: Feature = {
  id: 'effect.gaussian-blur',
  label: 'Gaussian Blur',
  kind: 'effect',
  category: 'blur',
  cost: 'high',
  order: 350,
  enabled: false,
  description: 'Smooth full-frame Gaussian blur',
  component: GaussianBlur,
  controls: {
    radius: { type: 'number', value: 3, min: 0.1, max: 12, step: 0.1 },
    sigma: { type: 'number', value: 2, min: 0.5, max: 8, step: 0.5 },
  },
}
