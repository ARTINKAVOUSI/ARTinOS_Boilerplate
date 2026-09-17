import { int } from 'three/tsl'
import { boxBlur } from 'three/addons/tsl/display/boxBlur.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

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
  usePostFXEffect(id, { enabled, order, build: ({ input }) => boxBlur(input, { size: int(size), separation: int(separation) }) }, [size, separation])
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
  component: BoxBlur,
  controls: {
    size: { type: 'number', value: 1, min: 1, max: 3, step: 1 },
    separation: { type: 'number', value: 1, min: 1, max: 12, step: 1 },
  },
}
