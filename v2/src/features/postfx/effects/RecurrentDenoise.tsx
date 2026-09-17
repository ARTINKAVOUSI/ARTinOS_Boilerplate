import { recurrentDenoise } from 'three/addons/tsl/display/RecurrentDenoiseNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface RecurrentDenoiseProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blend with previous frames. */
  accumulate?: boolean
}

/**
 * Recurrent Denoise — temporal + spatial denoiser, best after TRAA or noisy SSR/SSGI.
 *
 * Mount inside <PostFX>.
 */
export function RecurrentDenoise({ id = 'recurrent-denoise', enabled = true, order = 55, accumulate = true }: RecurrentDenoiseProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    needs: ['packedNormal'],
    webgpuOnly: true,
    build: ({ input, depth, packedNormal, camera }) => {
      if (!packedNormal) return null
      // 'raw' is sampled unconditionally by the node, so the unfiltered input doubles as it.
      return recurrentDenoise(input, camera, { depth, normal: packedNormal, raw: input, accumulate })
    },
  }, [accumulate])
  return null
}

export default RecurrentDenoise

export const feature: Feature = {
  id: 'effect.recurrent-denoise',
  label: 'Recurrent Denoise',
  kind: 'effect',
  category: 'screen-space',
  cost: 'very-high',
  order: 55,
  enabled: false,
  webgpuOnly: true,
  component: RecurrentDenoise,
  controls: {
    accumulate: { type: 'boolean', value: true },
  },
}
