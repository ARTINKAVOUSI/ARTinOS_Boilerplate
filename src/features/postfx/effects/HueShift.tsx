import { hue, vec4 } from 'three/tsl'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface HueShiftProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Rotation in radians. */
  adjustment?: number
}

/**
 * Hue Shift — rotates every colour around the hue wheel.
 *
 * Mount inside <PostFX>.
 */
export function HueShift({ id = 'hue', enabled = true, order = 402, adjustment = 0 }: HueShiftProps) {
  const adjustmentU = useUniform(adjustment)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(hue(input.rgb, adjustmentU), input.a) })
  return null
}

export default HueShift

export const feature: Feature = {
  id: 'effect.hue',
  label: 'Hue Shift',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 402,
  enabled: false,
  component: HueShift,
  controls: {
    adjustment: { type: 'number', value: 0, min: -3.1416, max: 3.1416, step: 0.01 },
  },
}
