import { posterize } from 'three/tsl'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface PosterizeProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Levels per channel. */
  steps?: number
}

/**
 * Posterize — quantises colour into flat bands.
 *
 * Mount inside <PostFX>.
 */
export function Posterize({ id = 'posterize', enabled = true, order = 405, steps = 8 }: PosterizeProps) {
  const stepsU = useUniform(steps)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => posterize(input, stepsU) })
  return null
}

export default Posterize

export const feature: Feature = {
  id: 'effect.posterize',
  label: 'Posterize',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 405,
  enabled: false,
  component: Posterize,
  controls: {
    steps: { type: 'number', value: 8, min: 2, max: 64, step: 1 },
  },
}
