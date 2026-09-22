import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface FXAAProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * FXAA — fast approximate anti-aliasing. Keep it last in the chain.
 *
 * Mount inside <PostFX>.
 */
export function FXAA({ id = 'fxaa', enabled = true, order = 990 }: FXAAProps) {
  usePostFXEffect(id, { enabled, order, build: ({ input }) => fxaa(input) })
  return null
}

export default FXAA

export const feature: Feature = {
  id: 'effect.fxaa',
  label: 'FXAA',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'low',
  order: 990,
  enabled: true,
  component: FXAA,
}
