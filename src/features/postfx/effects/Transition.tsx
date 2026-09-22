import { useEffect, useMemo } from 'react'
import { DataTexture, RepeatWrapping, RGBAFormat, SRGBColorSpace, TextureLoader, type Texture } from 'three/webgpu'
import { texture } from 'three/tsl'
import { transition } from 'three/addons/tsl/display/TransitionNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

/** Value noise, so the wipe has an organic edge without shipping a mask image. */
function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4)
  const lattice = Array.from({ length: 17 * 17 }, () => Math.random())
  const at = (x: number, y: number) => lattice[(y % 17) * 17 + (x % 17)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * 16, fy = (y / size) * 16
      const ix = Math.floor(fx), iy = Math.floor(fy)
      const tx = fx - ix, ty = fy - iy
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
      const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx
      const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx
      const v = Math.round((top + (bottom - top) * sy) * 255)
      const i = (y * size + x) * 4
      data[i] = data[i + 1] = data[i + 2] = v
      data[i + 3] = 255
    }
  }
  const map = new DataTexture(data, size, size, RGBAFormat)
  map.wrapS = map.wrapT = RepeatWrapping
  map.needsUpdate = true
  return map
}

export interface TransitionProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Progress, 0 = scene, 1 = image. */
  mix?: number
  /** Edge softness. */
  threshold?: number
  /** URL of the image to transition to. */
  image?: string
}

/**
 * Transition — wipes between the scene and an image through a procedural noise mask.
 *
 * Animate `mix` from 0 to 1 to play it.
 *
 * Mount inside <PostFX>.
 */
export function Transition({ id = 'transition', enabled = true, order = 950, mix = 0, threshold = 0.1, image = '/backgrounds/persian-garden.png' }: TransitionProps) {
  const mask = useMemo(() => noiseTexture(), [])
  const target = useMemo<Texture>(() => {
    const map = new TextureLoader().load(image)
    map.colorSpace = SRGBColorSpace
    return map
  }, [image])
  useEffect(() => () => target.dispose(), [target])
  useEffect(() => () => mask.dispose(), [mask])
  const mixU = useUniform(mix)
  const thresholdU = useUniform(threshold)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input }) => transition(input, texture(target), texture(mask), mixU, thresholdU, 1),
  }, [image, target, mask])
  return null
}

export default Transition

export const feature: Feature = {
  id: 'effect.transition',
  label: 'Transition',
  kind: 'effect',
  category: 'temporal',
  cost: 'medium',
  order: 950,
  enabled: false,
  webgpuOnly: true,
  component: Transition,
  controls: {
    mix: { type: 'number', value: 0, min: 0, max: 1, step: 0.001 },
    threshold: { type: 'number', value: 0.1, min: 0, max: 1, step: 0.01 },
    image: { type: 'text', value: '/backgrounds/persian-garden.png' },
  },
}
