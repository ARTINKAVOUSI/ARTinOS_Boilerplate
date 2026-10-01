import { convertToTexture, int } from 'three/tsl'
import { boxBlur } from 'three/addons/tsl/display/boxBlur.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface BoxBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Kernel size. */
  size?: number
  /** Sample spacing. */
  separation?: number
}

/**
 * Box Blur — cheap uniform blur.
 *
 * Mount inside <PostFX>.
 */
export function BoxBlur({ id = 'box-blur', enabled = true, order = 351, size = 1, separation = 1 }: BoxBlurProps) {
  const sizeU = useUniform(size)
  const separationU = useUniform(separation)
  // The input is resolved to a texture here rather than inside boxBlur, so the
  // render target is part of the chain and is freed with it.
  usePostFXEffect(id, { enabled, order, build: ({ input }) => boxBlur(convertToTexture(input), { size: int(sizeU), separation: separationU }) })
  return null
}

export default BoxBlur

export const feature: Feature = {
  id: 'effect.box-blur',
  label: 'Box Blur',
  kind: 'effect',
  category: 'blur',
  cost: 'low',
  order: 351,
  enabled: false,
  description: 'Cheap single-pass box blur; separation widens it at no extra cost',
  component: BoxBlur,
  controls: {
    size: { type: 'number', value: 1, min: 1, max: 3, step: 1 },
    separation: { type: 'number', value: 1, min: 1, max: 12, step: 1 },
  },
}
