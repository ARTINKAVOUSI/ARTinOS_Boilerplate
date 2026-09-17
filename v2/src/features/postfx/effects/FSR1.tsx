import { fsr1 } from 'three/addons/tsl/display/FSR1Node.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface FSR1Props {
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
 * FSR1 — AMD FidelityFX edge-adaptive sharpening.
 *
 * Mount inside <PostFX>.
 */
export function FSR1({ id = 'fsr1', enabled = true, order = 985, sharpness = 0.2, denoise = false }: FSR1Props) {
  const sharpnessU = useUniform(sharpness)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => fsr1(input, sharpnessU, denoise) }, [denoise])
  return null
}

export default FSR1

export const feature: Feature = {
  id: 'effect.fsr1',
  label: 'FSR1 Sharpen',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'medium',
  order: 985,
  enabled: false,
  component: FSR1,
  controls: {
    sharpness: { type: 'number', value: 0.2, min: 0, max: 2, step: 0.01 },
    denoise: { type: 'boolean', value: false },
  },
}
