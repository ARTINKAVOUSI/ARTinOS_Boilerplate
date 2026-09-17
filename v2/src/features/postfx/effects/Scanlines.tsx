import { vec4 } from 'three/tsl'
import { scanlines } from 'three/addons/tsl/display/CRT.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface ScanlinesProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Line darkness. */
  intensity?: number
  /** Lines per frame. */
  count?: number
  /** Scroll speed. */
  speed?: number
}

/**
 * Scanlines — CRT horizontal line pattern.
 *
 * Mount inside <PostFX>.
 */
export function Scanlines({ id = 'scanlines', enabled = true, order = 660, intensity = 0.3, count = 240, speed = 0 }: ScanlinesProps) {
  const intensityU = useUniform(intensity)
  const countU = useUniform(count)
  const speedU = useUniform(speed)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(scanlines(input.rgb, intensityU, countU, speedU), input.a) })
  return null
}

export default Scanlines

export const feature: Feature = {
  id: 'effect.scanlines',
  label: 'Scanlines',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 660,
  enabled: false,
  component: Scanlines,
  controls: {
    intensity: { type: 'number', value: 0.3, min: 0, max: 1, step: 0.01 },
    count: { type: 'number', value: 240, min: 20, max: 1200, step: 1 },
    speed: { type: 'number', value: 0, min: -4, max: 4, step: 0.01 },
  },
}
