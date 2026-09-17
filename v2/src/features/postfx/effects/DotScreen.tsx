import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface DotScreenProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Screen angle, radians. */
  angle?: number
  /** Dot size. */
  scale?: number
}

/**
 * Dot Screen — halftone print pattern.
 *
 * Mount inside <PostFX>.
 */
export function DotScreen({ id = 'dot-screen', enabled = true, order = 650, angle = 1.57, scale = 1 }: DotScreenProps) {
  const angleU = useUniform(angle)
  const scaleU = useUniform(scale)
  usePostFXEffect(id, {
    enabled,
    order,
    build: ({ input }) => {
      const node = dotScreen(input, angle, scale)
      // The node copies plain numbers into its own uniforms; swap in the live ones.
      node.angle = angleU
      node.scale = scaleU
      return node
    },
  })
  return null
}

export default DotScreen

export const feature: Feature = {
  id: 'effect.dot-screen',
  label: 'Dot Screen',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 650,
  enabled: false,
  component: DotScreen,
  controls: {
    angle: { type: 'number', value: 1.57, min: 0, max: 6.283, step: 0.01 },
    scale: { type: 'number', value: 1, min: 0.1, max: 10, step: 0.1 },
  },
}
