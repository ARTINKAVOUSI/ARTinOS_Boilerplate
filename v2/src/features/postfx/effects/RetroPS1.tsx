import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface RetroPS1Props {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
}

/**
 * Retro — PlayStation-1 style render: vertex snapping, affine textures, low resolution.
 * Re-renders the scene, so it replaces the scene pass.
 *
 * Mount inside <PostFX>.
 */
export function RetroPS1({ id = 'retro', enabled = true, order = 12 }: RetroPS1Props) {
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ scene, camera }) => retroPass(scene, camera).getTextureNode(),
  })
  return null
}

export default RetroPS1

export const feature: Feature = {
  id: 'effect.retro',
  label: 'Retro (PS1)',
  kind: 'effect',
  category: 'stylize',
  cost: 'medium',
  order: 12,
  enabled: false,
  webgpuOnly: true,
  component: RetroPS1,
}
