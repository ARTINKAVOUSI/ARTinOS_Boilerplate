import { bleach } from 'three/addons/tsl/display/BleachBypass.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface BleachBypassProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Strength of the look. */
  opacity?: number
}

/**
 * Bleach Bypass — high-contrast, desaturated film look.
 *
 * Mount inside <PostFX>.
 */
export function BleachBypass({ id = 'bleach', enabled = true, order = 404, opacity = 0.5 }: BleachBypassProps) {
  const opacityU = useUniform(opacity)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => bleach(input, opacityU) })
  return null
}

export default BleachBypass

export const feature: Feature = {
  id: 'effect.bleach',
  label: 'Bleach Bypass',
  kind: 'effect',
  category: 'color',
  cost: 'low',
  order: 404,
  enabled: false,
  component: BleachBypass,
  controls: {
    opacity: { type: 'number', value: 0.5, min: 0, max: 1, step: 0.01 },
  },
}
