import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface WideBloomProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Glow intensity. */
  scale?: number
  /** Luminance above which pixels glow. */
  threshold?: number
}

/**
 * Wide Bloom — a broad, high-threshold glow on highlights only (the anamorphic look).
 *
 * Mount inside <PostFX>.
 */
export function WideBloom({ id = 'wide-bloom', enabled = true, order = 110, scale = 3, threshold = 0.9 }: WideBloomProps) {
  const scaleU = useUniform(scale)
  const thresholdU = useUniform(threshold)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => input.add(bloom(input, scaleU, 0.9, thresholdU)) })
  return null
}

export default WideBloom

export const feature: Feature = {
  id: 'effect.wide-bloom',
  label: 'Wide Bloom',
  kind: 'effect',
  category: 'light',
  cost: 'high',
  order: 110,
  enabled: false,
  component: WideBloom,
  controls: {
    scale: { type: 'number', value: 3, min: 0.1, max: 10, step: 0.1 },
    threshold: { type: 'number', value: 0.9, min: 0, max: 1, step: 0.01 },
  },
}
