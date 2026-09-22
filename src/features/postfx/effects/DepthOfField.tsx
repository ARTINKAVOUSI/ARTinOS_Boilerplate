import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface DepthOfFieldProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Distance in focus, in world units. */
  focusDistance?: number
  /** Depth of the in-focus band. */
  focalLength?: number
  /** Size of the bokeh. */
  bokehScale?: number
}

/**
 * Depth of Field — blurs what lies outside the focus band.
 *
 * Mount inside <PostFX>.
 */
export function DepthOfField({ id = 'dof', enabled = true, order = 200, focusDistance = 5, focalLength = 2, bokehScale = 2 }: DepthOfFieldProps) {
  const focusDistanceU = useUniform(focusDistance)
  const focalLengthU = useUniform(focalLength)
  const bokehScaleU = useUniform(bokehScale)
  usePostFXEffect(id, { enabled, order, build: ({ input, viewZ }) => dof(input, viewZ, focusDistanceU, focalLengthU, bokehScaleU) })
  return null
}

export default DepthOfField

export const feature: Feature = {
  id: 'effect.dof',
  label: 'Depth of Field',
  kind: 'effect',
  category: 'lens',
  cost: 'high',
  order: 200,
  enabled: false,
  component: DepthOfField,
  controls: {
    focusDistance: { type: 'number', value: 5, min: 0.1, max: 50, step: 0.05 },
    focalLength: { type: 'number', value: 2, min: 0.05, max: 20, step: 0.05 },
    bokehScale: { type: 'number', value: 2, min: 0, max: 10, step: 0.05 },
  },
}
