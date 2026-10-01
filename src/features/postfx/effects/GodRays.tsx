import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, type DirectionalLight, type Object3D, type PointLight } from 'three/webgpu'
import { convertToTexture, uniform } from 'three/tsl'
import { godrays } from 'three/addons/tsl/display/GodraysNode.js'
import { depthAwareBlend } from 'three/addons/tsl/display/depthAwareBlend.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, findLight } from '../PostFX'

export interface GodRaysProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Colour of the shafts. */
  tint?: string
  /** The light the rays come from. */
  light?: DirectionalLight | PointLight
}

/** The default light: the first shadow-casting directional or point light. */
const isShadowLight = (object: Object3D) => {
  const candidate = object as DirectionalLight & { isPointLight?: boolean }
  return candidate.castShadow && !!(candidate.isDirectionalLight || candidate.isPointLight)
}

/** Frames between scene searches while no usable light is held. */
const SEARCH_INTERVAL = 30

/**
 * God Rays — raymarched light shafts from the scene's shadow-casting light.
 *
 * Needs a directional or point light with `castShadow`, and shadow-casting geometry.
 * Pass `light` to choose it; otherwise the first shadow-casting one is used.
 *
 * Mount inside <PostFX>.
 */
export function GodRays({ id = 'god-rays', enabled = true, order = 130, tint = '#fff1d6', light }: GodRaysProps) {
  const scene = useThree(state => state.scene)
  const [source, setSource] = useState<DirectionalLight | PointLight | null>(null)
  const held = useRef<DirectionalLight | PointLight | null>(null)
  const sinceSearch = useRef(SEARCH_INTERVAL)
  // One uniform for the component's life, so a colour edit needs no rebuild.
  const tintU = useMemo(() => uniform(new Color()), [])
  tintU.value.set(tint)
  // The node reads the light's shadow map when it is built, and the map only exists after the
  // light's first shadow render, so wait for it (and follow the light if it is replaced).
  // The light found is held while it stays in the scene and casts shadows; without one the
  // scene is searched at most every SEARCH_INTERVAL frames.
  useFrame(() => {
    sinceSearch.current++
    const kept = held.current
    if (!light && !(kept?.parent && kept.castShadow)) {
      held.current = null
      if (sinceSearch.current >= SEARCH_INTERVAL) {
        sinceSearch.current = 0
        held.current = (findLight(scene, isShadowLight) as DirectionalLight | PointLight | undefined) ?? null
      }
    }
    const found = light ?? held.current
    const next = found?.shadow?.map ? found : null
    if (next !== source) setSource(next)
  })
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input, depth, camera }) => {
      if (!source) return null
      const rays = godrays(depth, camera, source).getTextureNode()
      // The blend samples its base, so an upstream effect chain has to be resolved to a texture first.
      return depthAwareBlend(convertToTexture(input), rays, depth, camera, { blendColor: tintU })
    },
  }, [light, source])
  return null
}

export default GodRays

export const feature: Feature = {
  id: 'effect.god-rays',
  label: 'God Rays',
  kind: 'effect',
  category: 'light',
  cost: 'high',
  order: 130,
  enabled: false,
  webgpuOnly: true,
  description: 'Raymarched light shafts from the first shadow-casting light',
  component: GodRays,
  controls: {
    tint: { type: 'color', value: '#fff1d6' },
  },
}
