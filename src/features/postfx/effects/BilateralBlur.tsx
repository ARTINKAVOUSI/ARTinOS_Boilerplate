import { vec2 } from 'three/tsl'
import { bilateralBlur } from 'three/addons/tsl/display/BilateralBlurNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect } from '../PostFX'

export interface BilateralBlurProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Spatial kernel width, rounded to 0.5 (it is baked into the shader). */
  sigma?: number
  /** Colour tolerance, rounded to 0.05 and at least 0.05 (baked in too). */
  sigmaColor?: number
}

/**
 * Bilateral Blur — edge-preserving blur; smooths surfaces, keeps outlines.
 *
 * Mount inside <PostFX>.
 */
export function BilateralBlur({ id = 'bilateral-blur', enabled = true, order = 354, sigma = 2, sigmaColor = 0.1 }: BilateralBlurProps) {
  // Structural: every new value rebuilds the chain, and a slider drag delivers
  // fractions, so snap to the controls' steps to rebuild a handful of times.
  // The tolerance divides in the shader, so it never reaches 0.
  const spatial = Math.round(sigma * 2) / 2
  const tolerance = Math.max(0.05, Math.round(sigmaColor * 20) / 20)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input }) => bilateralBlur(input, vec2(1, 1), spatial, tolerance),
  }, [spatial, tolerance])
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
  description: 'Edge-preserving blur: smooths surfaces, keeps outlines sharp',
  component: BilateralBlur,
  controls: {
    sigma: { type: 'number', value: 2, min: 0.5, max: 8, step: 0.5 },
    sigmaColor: { type: 'number', value: 0.1, min: 0.05, max: 1, step: 0.05 },
  },
}
