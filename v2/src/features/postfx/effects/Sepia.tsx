import { sepia } from 'three/addons/tsl/display/Sepia.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface SepiaProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blend with the original. */
  amount?: number
}

/**
 * Sepia — warm antique toning.
 *
 * Mount inside <PostFX>.
 */
export function Sepia({ id = 'sepia', enabled = true, order = 400, amount = 1 }: SepiaProps) {
  const amountU = useUniform(amount)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => input.mix(sepia(input), amountU) })
  return null
}

export default Sepia

export const feature: Feature = {
  id: 'effect.sepia',
  label: 'Sepia',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 400,
  enabled: false,
  component: Sepia,
  controls: {
    amount: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
  },
}
