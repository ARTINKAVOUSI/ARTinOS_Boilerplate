import { useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { DirectionalLight, PointLight } from 'three/webgpu'
import { sss } from 'three/addons/tsl/display/SSSNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, findLight } from '../PostFX'

export interface SubsurfaceScatteringProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** The light the scattering is lit from. */
  light?: DirectionalLight | PointLight
}

/**
 * Subsurface Scattering — screen-space light bleeding through thin geometry,
 * lit from the scene's main light.
 *
 * Needs a directional or point light. Pass `light` to choose it; otherwise the
 * first one in the scene is used.
 *
 * Mount inside <PostFX>.
 */
export function SubsurfaceScattering({ id = 'sss', enabled = true, order = 140, light }: SubsurfaceScatteringProps) {
  const scene = useThree(state => state.scene)
  const [source, setSource] = useState<DirectionalLight | PointLight | null>(null)
  // The node captures the light when it is built, so wait until one exists and
  // follow it if the scene replaces it.
  useFrame(() => {
    const found =
      light ??
      (findLight(scene, object => {
        const candidate = object as DirectionalLight & { isPointLight?: boolean }
        return !!(candidate.isDirectionalLight || candidate.isPointLight)
      }) as DirectionalLight | PointLight | undefined)
    if ((found ?? null) !== source) setSource(found ?? null)
  })

  usePostFXEffect(
    id,
    {
      enabled,
      order,
      webgpuOnly: true,
      // The node takes a directional light; a point light is passed through the same slot.
      build: ({ input, depth, camera }) => (source ? input.add(sss(depth, camera, source as never)) : null),
    },
    [light, source],
  )
  return null
}

export default SubsurfaceScattering

export const feature: Feature = {
  id: 'effect.sss',
  label: 'Subsurface Scattering',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 140,
  enabled: false,
  webgpuOnly: true,
  description: 'Light bleeding through thin geometry, from the scene’s main light',
  component: SubsurfaceScattering,
}
