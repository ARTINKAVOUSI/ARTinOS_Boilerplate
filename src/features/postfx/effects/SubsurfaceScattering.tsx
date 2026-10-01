import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { DirectionalLight, Object3D, PointLight } from 'three/webgpu'
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

/** The default light: the first directional or point light in the scene. */
const isMainLight = (object: Object3D) => {
  const candidate = object as DirectionalLight & { isPointLight?: boolean }
  return !!(candidate.isDirectionalLight || candidate.isPointLight)
}

/** Frames between scene searches while no light is held. */
const SEARCH_INTERVAL = 30

/**
 * Subsurface Scattering — despite the name, not a scattering effect.
 *
 * What it does today: it runs three's Screen-Space Shadows node (`SSSNode`, the
 * node ScreenSpaceShadows uses) from the main light and ADDS its output to the
 * image. That output is a shadow factor (1 where lit, lower inside contact
 * shadows), so every lit pixel gains about +1 per channel and the frame washes
 * out towards white. No light travels through geometry.
 *
 * Lit from `light`, or else the first directional or point light in the scene.
 * SSSNode aims along the light's `target`, which a point light does not have,
 * so expect render errors with one.
 *
 * Mount inside <PostFX>.
 */
export function SubsurfaceScattering({ id = 'subsurface', enabled = true, order = 140, light }: SubsurfaceScatteringProps) {
  const scene = useThree(state => state.scene)
  const [source, setSource] = useState<DirectionalLight | PointLight | null>(null)
  const sinceSearch = useRef(SEARCH_INTERVAL)
  // The node captures the light when it is built, so wait until one exists and
  // follow it if the scene replaces it. A light is kept while it stays in the
  // scene; without one the scene is searched at most every SEARCH_INTERVAL frames.
  useFrame(() => {
    sinceSearch.current++
    let next: DirectionalLight | PointLight | null = light ?? (source?.parent ? source : null)
    if (!next && sinceSearch.current >= SEARCH_INTERVAL) {
      sinceSearch.current = 0
      next = (findLight(scene, isMainLight) as DirectionalLight | PointLight | undefined) ?? null
    }
    if (next !== source) setSource(next)
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
  id: 'effect.subsurface',
  label: 'Subsurface Scattering',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 140,
  enabled: false,
  webgpuOnly: true,
  description: 'Not real SSS: adds a screen-space shadow term, washing the image out',
  component: SubsurfaceScattering,
}
