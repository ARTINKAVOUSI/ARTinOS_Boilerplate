import { film } from 'three/addons/tsl/display/FilmNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface FilmGrainProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Grain strength. */
  intensity?: number
}

/**
 * Film Grain — animated photographic noise.
 *
 * Mount inside <PostFX>.
 */
export function FilmGrain({ id = 'film-grain', enabled = true, order = 800, intensity = 0.12 }: FilmGrainProps) {
  const intensityU = useUniform(intensity)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => film(input, intensityU) })
  return null
}

export default FilmGrain

export const feature: Feature = {
  id: 'effect.film-grain',
  label: 'Film Grain',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 800,
  enabled: false,
  component: FilmGrain,
  controls: {
    intensity: { type: 'number', value: 0.12, min: 0, max: 1, step: 0.005 },
  },
}
