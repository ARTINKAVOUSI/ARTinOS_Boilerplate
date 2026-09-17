import { useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { DirectionalLight, PointLight } from 'three/webgpu'
import { color, convertToTexture } from 'three/tsl'
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
  // The node reads the light's shadow map when it is built, and the map only exists after the
  // light's first shadow render, so wait for it (and follow the light if it is replaced).
  useFrame(() => {
    const found = light ?? (findLight(scene, object => { const o = object as DirectionalLight & { isPointLight?: boolean }; return o.castShadow && !!(o.isDirectionalLight || o.isPointLight) }) as DirectionalLight | PointLight | undefined)
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
      return depthAwareBlend(convertToTexture(input), rays, depth, camera, { blendColor: color(tint) })
    },
  }, [tint, light, source])
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
  component: GodRays,
  controls: {
    tint: { type: 'color', value: '#fff1d6' },
  },
}
