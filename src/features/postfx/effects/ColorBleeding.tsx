import { vec4 } from 'three/tsl'
import { colorBleeding } from 'three/addons/tsl/display/CRT.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

export interface ColorBleedingProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Smear distance. */
  amount?: number
}

/**
 * Color Bleeding — analogue-video colour smear.
 *
 * Mount inside <PostFX>.
 */
export function ColorBleeding({ id = 'color-bleeding', enabled = true, order = 661, amount = 0.002 }: ColorBleedingProps) {
  const amountU = useUniform(amount)
  usePostFXEffect(id, { enabled, order, build: ({ input }) => vec4(colorBleeding(input.rgb, amountU), input.a) })
  return null
}

export default ColorBleeding

export const feature: Feature = {
  id: 'effect.color-bleeding',
  label: 'Color Bleeding',
  kind: 'effect',
  category: 'stylize',
  cost: 'low',
  order: 661,
  enabled: false,
  component: ColorBleeding,
  controls: {
    amount: { type: 'number', value: 0.002, min: 0, max: 0.01, step: 0.0001 },
  },
}
