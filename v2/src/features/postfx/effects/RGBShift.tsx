import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface RGBShiftProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Offset. */
  amount?: number
  /** Direction, radians. */
  angle?: number
}

/**
 * RGB Shift — offsets the red and blue channels across the frame.
 *
 * Mount inside <PostFX>.
 */
export function RGBShift({ id = 'rgb-shift', enabled = true, order = 610, amount = 0.003, angle = 0 }: RGBShiftProps) {
  const amountU = useUniform(amount)
  const angleU = useUniform(angle)
  usePostFXEffect(id, {
    enabled,
    order,
    build: ({ input }) => {
      const node = rgbShift(input, amount, angle)
      node.amount = amountU
      node.angle = angleU
      return node
    },
  })
  return null
}

export default RGBShift

export const feature: Feature = {
  id: 'effect.rgb-shift',
  label: 'RGB Shift',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 610,
  enabled: false,
  component: RGBShift,
  controls: {
    amount: { type: 'number', value: 0.003, min: 0, max: 0.05, step: 0.0001 },
    angle: { type: 'number', value: 0, min: 0, max: 6.283, step: 0.01 },
  },
}
