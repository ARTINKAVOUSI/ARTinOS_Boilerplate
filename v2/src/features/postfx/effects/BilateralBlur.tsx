import { vec2 } from 'three/tsl'
import { bilateralBlur } from 'three/addons/tsl/display/BilateralBlurNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface BilateralBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Spatial kernel width. */
  sigma?: number
  /** Colour tolerance. */
  sigmaColor?: number
}

/**
 * Bilateral Blur — edge-preserving blur; smooths surfaces, keeps outlines.
 *
 * Mount inside <PostFX>.
 */
export function BilateralBlur({ id = 'bilateral-blur', enabled = true, order = 354, sigma = 2, sigmaColor = 0.1 }: BilateralBlurProps) {
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input }) => bilateralBlur(input, vec2(1, 1), sigma, sigmaColor),
  }, [sigma, sigmaColor])
  return null
}

export default BilateralBlur

export const feature: Feature = {
  id: 'effect.bilateral-blur',
  label: 'Bilateral Blur',
  kind: 'effect',
  category: 'blur',
  cost: 'high',
  order: 354,
  enabled: false,
  webgpuOnly: true,
  component: BilateralBlur,
  controls: {
    sigma: { type: 'number', value: 2, min: 0.5, max: 8, step: 0.1 },
    sigmaColor: { type: 'number', value: 0.1, min: 0.01, max: 1, step: 0.01 },
  },
}
