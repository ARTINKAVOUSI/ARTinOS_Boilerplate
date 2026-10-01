import { useEffect, useRef } from 'react'
import { lensflare } from 'three/addons/tsl/display/LensflareNode.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface LensFlareProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Luminance that produces ghosts. */
  threshold?: number
  /** Distance between ghosts. */
  ghostSpacing?: number
  /** Ghost falloff. */
  ghostAttenuation?: number
  /** Number of ghosts. */
  ghostSamples?: number
  /** Internal resolution divisor. */
  downSampleRatio?: number
}

/**
 * Lens Flare — ghosts and halos from bright sources.
 *
 * Mount inside <PostFX>.
 */
export function LensFlare({ id = 'lens-flare', enabled = true, order = 120, threshold = 0.5, ghostSpacing = 0.25, ghostAttenuation = 25, ghostSamples = 4, downSampleRatio = 4 }: LensFlareProps) {
  const thresholdU = useUniform(threshold)
  const ghostSpacingU = useUniform(ghostSpacing)
  const ghostAttenuationU = useUniform(ghostAttenuation)
  const ghostSamplesU = useUniform(ghostSamples)
  // The node reads downSampleRatio every frame when it sizes its target, so it is
  // assigned live instead of rebuilding.
  const ratio = useRef(downSampleRatio)
  const flare = useRef<ReturnType<typeof lensflare> | null>(null)
  useEffect(() => {
    ratio.current = downSampleRatio
    if (flare.current) flare.current.downSampleRatio = downSampleRatio
  }, [downSampleRatio])
  usePostFXEffect(id, {
    enabled,
    order,
    build: ({ input }) => {
      const node = lensflare(input, { threshold: thresholdU, ghostSpacing: ghostSpacingU, ghostAttenuationFactor: ghostAttenuationU, ghostSamples: ghostSamplesU, downSampleRatio: ratio.current })
      flare.current = node
      return input.add(node)
    },
  })
  return null
}

export default LensFlare

export const feature: Feature = {
  id: 'effect.lens-flare',
  label: 'Lens Flare',
  kind: 'effect',
  category: 'light',
  cost: 'high',
  order: 120,
  enabled: false,
  description: 'Ghosts and halos from bright sources, added over the image',
  component: LensFlare,
  controls: {
    threshold: { type: 'number', value: 0.5, min: 0, max: 1, step: 0.01 },
    ghostSpacing: { type: 'number', value: 0.25, min: 0.01, max: 1, step: 0.01 },
    ghostAttenuation: { type: 'number', value: 25, min: 1, max: 100, step: 1 },
    ghostSamples: { type: 'number', value: 4, min: 1, max: 12, step: 1 },
    downSampleRatio: { type: 'number', value: 4, min: 1, max: 8, step: 1 },
  },
}
