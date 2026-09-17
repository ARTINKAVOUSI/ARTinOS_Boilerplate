import { vec2 } from 'three/tsl'
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface ChromaticAberrationProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Channel separation. */
  strength?: number
  /** Radial falloff. */
  scale?: number
}

/**
 * Chromatic Aberration — colour fringing that grows towards the frame edge.
 *
 * Mount inside <PostFX>.
 */
export function ChromaticAberration({ id = 'chromatic-aberration', enabled = true, order = 600, strength = 1, scale = 1.1 }: ChromaticAberrationProps) {
  const strengthU = useUniform(strength)
  const scaleU = useUniform(scale)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => chromaticAberration(input, strengthU, vec2(0.5, 0.5), scaleU) })
  return null
}

export default ChromaticAberration

export const feature: Feature = {
  id: 'effect.chromatic-aberration',
  label: 'Chromatic Aberration',
  kind: 'effect',
  category: 'lens',
  cost: 'low',
  order: 600,
  enabled: false,
  component: ChromaticAberration,
  controls: {
    strength: { type: 'number', value: 1, min: 0, max: 5, step: 0.01 },
    scale: { type: 'number', value: 1.1, min: 1, max: 2, step: 0.01 },
  },
}
