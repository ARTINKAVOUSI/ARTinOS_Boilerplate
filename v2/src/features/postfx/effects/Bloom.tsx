import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface BloomProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Glow intensity. */
  strength?: number
  /** Glow spread, 0–1. */
  radius?: number
  /** Luminance above which pixels glow. */
  threshold?: number
}

/**
 * Bloom — bright areas bleed light into their surroundings.
 *
 * Mount inside <PostFX>.
 */
export function Bloom({ id = 'bloom', enabled = true, order = 100, strength = 0.6, radius = 0.3, threshold = 0.82 }: BloomProps) {
  const strengthU = useUniform(strength)
  const radiusU = useUniform(radius)
  const thresholdU = useUniform(threshold)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => input.add(bloom(input, strengthU, radiusU, thresholdU)) })
  return null
}

export default Bloom

export const feature: Feature = {
  id: 'effect.bloom',
  label: 'Bloom',
  kind: 'effect',
  category: 'light',
  cost: 'medium',
  order: 100,
  enabled: true,
  component: Bloom,
  controls: {
    strength: { type: 'number', value: 0.6, min: 0, max: 5, step: 0.01 },
    radius: { type: 'number', value: 0.3, min: 0, max: 1, step: 0.01 },
    threshold: { type: 'number', value: 0.82, min: 0, max: 1, step: 0.01 },
  },
}
