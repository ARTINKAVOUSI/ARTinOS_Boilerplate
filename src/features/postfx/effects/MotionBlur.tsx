import { convertToTexture, int } from 'three/tsl'
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface MotionBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blur taps. */
  samples?: number
}

/**
 * Motion Blur — per-pixel blur along screen-space velocity.
 *
 * Mount inside <PostFX>.
 */
export function MotionBlur({ id = 'motion-blur', enabled = true, order = 310, samples = 16 }: MotionBlurProps) {
  // The node's loop bound, so a uniform changes the tap count without a rebuild.
  const samplesU = useUniform(samples)
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['velocity'],
    build: ({ input, velocity }) => (velocity ? motionBlur(convertToTexture(input), velocity, int(samplesU)) : null),
  })
  return null
}

export default MotionBlur

export const feature: Feature = {
  id: 'effect.motion-blur',
  label: 'Motion Blur',
  kind: 'effect',
  category: 'temporal',
  cost: 'high',
  order: 310,
  enabled: false,
  description: 'Blurs each pixel along its screen-space motion',
  component: MotionBlur,
  controls: {
    samples: { type: 'number', value: 16, min: 4, max: 64, step: 1 },
  },
}
