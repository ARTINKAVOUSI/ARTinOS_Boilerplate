import { taau } from 'three/addons/tsl/display/TAAUNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface TAAUProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * TAAU — temporal anti-aliasing with upscaling.
 *
 * Mount inside <PostFX>.
 */
export function TAAU({ id = 'taau', enabled = true, order = 981 }: TAAUProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['velocity'],
    build: ({ input, depth, velocity, camera }) => (velocity ? taau(input, depth, velocity, camera) : null),
  })
  return null
}

export default TAAU

export const feature: Feature = {
  id: 'effect.taau',
  label: 'TAAU',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'high',
  order: 981,
  enabled: false,
  component: TAAU,
}
