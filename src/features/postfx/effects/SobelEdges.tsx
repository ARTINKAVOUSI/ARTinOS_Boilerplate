import { sobel } from 'three/addons/tsl/display/SobelOperatorNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface SobelEdgesProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * Sobel Edges — replaces the image with its edge outline.
 *
 * Mount inside <PostFX>.
 */
export function SobelEdges({ id = 'sobel', enabled = true, order = 640 }: SobelEdgesProps) {
  usePostFXEffect(id, { enabled, order, build: ({ input }) => sobel(input) })
  return null
}

export default SobelEdges

export const feature: Feature = {
  id: 'effect.sobel',
  label: 'Sobel Edges',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 640,
  enabled: false,
  component: SobelEdges,
}
