import { pixelationPass } from 'three/addons/tsl/display/PixelationPassNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface PixelationProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Pixel size, in screen pixels. */
  pixelSize?: number
  /** Normal edge strength. */
  normalEdge?: number
  /** Depth edge strength. */
  depthEdge?: number
}

/**
 * Pixelation — low-resolution pixel-art render with normal and depth edge lines.
 * Re-renders the scene, so it replaces the scene pass.
 *
 * Mount inside <PostFX>.
 */
export function Pixelation({ id = 'pixelation', enabled = true, order = 11, pixelSize = 6, normalEdge = 0.3, depthEdge = 0.4 }: PixelationProps) {
  const pixelSizeU = useUniform(pixelSize)
  const normalEdgeU = useUniform(normalEdge)
  const depthEdgeU = useUniform(depthEdge)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ scene, camera }) => pixelationPass(scene, camera, pixelSizeU, normalEdgeU, depthEdgeU).getTextureNode(),
  })
  return null
}

export default Pixelation

export const feature: Feature = {
  id: 'effect.pixelation',
  label: 'Pixelation',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 11,
  enabled: false,
  webgpuOnly: true,
  component: Pixelation,
  controls: {
    pixelSize: { type: 'number', value: 6, min: 1, max: 32, step: 1 },
    normalEdge: { type: 'number', value: 0.3, min: 0, max: 2, step: 0.01 },
    depthEdge: { type: 'number', value: 0.4, min: 0, max: 2, step: 0.01 },
  },
}
