import { afterImage } from 'three/addons/tsl/display/AfterImageNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface AfterImageProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Trail persistence, 0–1. */
  damp?: number
}

/**
 * Afterimage — moving things leave fading trails.
 *
 * Mount inside <PostFX>.
 */
export function AfterImage({ id = 'after-image', enabled = true, order = 300, damp = 0.9 }: AfterImageProps) {
  const dampU = useUniform(damp)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => afterImage(input, dampU) })
  return null
}

export default AfterImage

export const feature: Feature = {
  id: 'effect.after-image',
  label: 'Afterimage',
  kind: 'effect',
  category: 'temporal',
  cost: 'medium',
  order: 300,
  enabled: false,
  component: AfterImage,
  controls: {
    damp: { type: 'number', value: 0.9, min: 0, max: 0.995, step: 0.001 },
  },
}
