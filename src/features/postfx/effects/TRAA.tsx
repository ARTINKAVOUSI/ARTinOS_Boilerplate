import { traa } from 'three/addons/tsl/display/TRAANode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface TRAAProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * TRAA — temporal reprojection anti-aliasing. Smoothest edges; resolves over a few frames.
 *
 * Mount inside <PostFX>.
 */
export function TRAA({ id = 'traa', enabled = true, order = 980 }: TRAAProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['velocity'],
    build: ({ input, depth, velocity, camera }) => (velocity ? traa(input, depth, velocity, camera) : null),
  })
  return null
}

export default TRAA

export const feature: Feature = {
  id: 'effect.traa',
  label: 'TRAA',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'high',
  order: 980,
  enabled: false,
  component: TRAA,
}
