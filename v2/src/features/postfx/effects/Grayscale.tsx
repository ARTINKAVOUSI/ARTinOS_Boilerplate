import { grayscale, mix, vec4 } from 'three/tsl'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface GrayscaleProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blend with the original. */
  amount?: number
}

/**
 * Grayscale — removes colour.
 *
 * Mount inside <PostFX>.
 */
export function Grayscale({ id = 'grayscale', enabled = true, order = 401, amount = 1 }: GrayscaleProps) {
  const amountU = useUniform(amount)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(mix(input.rgb, grayscale(input.rgb), amountU), input.a) })
  return null
}

export default Grayscale

export const feature: Feature = {
  id: 'effect.grayscale',
  label: 'Grayscale',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 401,
  enabled: false,
  component: Grayscale,
  controls: {
    amount: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
  },
}
