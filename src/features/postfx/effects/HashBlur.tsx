import { convertToTexture } from 'three/tsl'
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface HashBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blur radius. */
  amount?: number
  /** Samples. */
  repeats?: number
}

/**
 * Hash Blur — stochastic, frosted-glass style blur.
 *
 * Mount inside <PostFX>.
 */
export function HashBlur({ id = 'hash-blur', enabled = true, order = 352, amount = 0.08, repeats = 32 }: HashBlurProps) {
  const amountU = useUniform(amount)
  const repeatsU = useUniform(repeats)
  // The input is resolved to a texture here rather than inside hashBlur, so the
  // render target is part of the chain and is freed with it.
  usePostFXEffect(id, { enabled, order, build: ({ input }) => hashBlur(convertToTexture(input), amountU, { repeats: repeatsU } as Parameters<typeof hashBlur>[2]) })
  return null
}

export default HashBlur

export const feature: Feature = {
  id: 'effect.hash-blur',
  label: 'Hash Blur',
  kind: 'effect',
  category: 'blur',
  cost: 'medium',
  order: 352,
  enabled: false,
  description: 'Stochastic frosted-glass blur from randomly scattered samples',
  component: HashBlur,
  controls: {
    amount: { type: 'number', value: 0.08, min: 0, max: 0.5, step: 0.005 },
    repeats: { type: 'number', value: 32, min: 4, max: 96, step: 1 },
  },
}
