import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface DenoiseProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * Denoise — depth- and normal-aware spatial denoiser for noisy screen-space effects.
 *
 * Mount inside <PostFX>.
 */
export function Denoise({ id = 'denoise', enabled = true, order = 50 }: DenoiseProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['normal'],
    build: ({ input, depth, normal, camera }) => (normal ? denoise(input, depth, normal, camera) : null),
  })
  return null
}

export default Denoise

export const feature: Feature = {
  id: 'effect.denoise',
  label: 'Denoise',
  kind: 'effect',
  category: 'screen-space',
  cost: 'medium',
  order: 50,
  enabled: false,
  component: Denoise,
}
