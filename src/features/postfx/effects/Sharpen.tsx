import { sharpen } from 'three/addons/tsl/display/SharpenNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface SharpenProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Sharpening amount. */
  sharpness?: number
  /** Suppress sharpening noise. */
  denoise?: boolean
}

/**
 * Sharpen — contrast-adaptive sharpening.
 *
 * Mount inside <PostFX>.
 */
export function Sharpen({ id = 'sharpen', enabled = true, order = 406, sharpness = 0.35, denoise = false }: SharpenProps) {
  const sharpnessU = useUniform(sharpness)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => sharpen(input, sharpnessU, denoise) }, [denoise])
  return null
}

export default Sharpen

export const feature: Feature = {
  id: 'effect.sharpen',
  label: 'Sharpen',
  kind: 'effect',
  category: 'color',
  cost: 'medium',
  order: 406,
  enabled: false,
  component: Sharpen,
  controls: {
    sharpness: { type: 'number', value: 0.35, min: 0, max: 2, step: 0.01 },
    denoise: { type: 'boolean', value: false },
  },
}
