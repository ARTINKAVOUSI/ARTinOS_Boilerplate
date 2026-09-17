import { saturation, vec4 } from 'three/tsl'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface SaturationProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Saturation multiplier. */
  adjustment?: number
}

/**
 * Saturation — scales colour intensity; 0 is grey, above 1 is vivid.
 *
 * Mount inside <PostFX>.
 */
export function Saturation({ id = 'saturation', enabled = true, order = 403, adjustment = 1.1 }: SaturationProps) {
  const adjustmentU = useUniform(adjustment)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(saturation(input.rgb, adjustmentU), input.a) })
  return null
}

export default Saturation

export const feature: Feature = {
  id: 'effect.saturation',
  label: 'Saturation',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 403,
  enabled: false,
  component: Saturation,
  controls: {
    adjustment: { type: 'number', value: 1.1, min: 0, max: 3, step: 0.01 },
  },
}
