import { smaa } from 'three/addons/tsl/display/SMAANode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface SMAAProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * SMAA — subpixel morphological anti-aliasing; crisper than FXAA.
 *
 * Mount inside <PostFX>.
 */
export function SMAA({ id = 'smaa', enabled = true, order = 991 }: SMAAProps) {
  usePostFXEffect(id, { enabled, order, build: ({ input }) => smaa(input) })
  return null
}

export default SMAA

export const feature: Feature = {
  id: 'effect.smaa',
  label: 'SMAA',
  kind: 'effect',
  category: 'anti-aliasing',
  cost: 'medium',
  order: 991,
  enabled: false,
  component: SMAA,
}
