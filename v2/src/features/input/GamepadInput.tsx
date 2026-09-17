import { useEffect } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from './signals'

export interface GamepadInputProps {
  /** Which pad to read. 0 is the first one connected. */
  index?: number
  /** Stick movement below this is treated as zero. */
  deadzone?: number
}

/**
 * GamepadInput — publishes the Gamepad API as signals:
 *
 *   `pad.axis.<n>`     −1…1 per axis, dead-zoned
 *   `pad.leftX/Y`, `pad.rightX/Y`
 *   `pad.button.<n>`   0…1 (analogue triggers keep their value)
 *   `pad.connected`    1 while a pad is present
 *
 * A pad appears only after the first button press, which is the browser's rule.
 */
export function GamepadInput({ index = 0, deadzone = 0.08 }: GamepadInputProps) {
  const bus = useSignals()
  useSignalCleanup('pad')

  useEffect(() => {
    let frame = 0
    const curve = (value: number) => (Math.abs(value) < deadzone ? 0 : (value - Math.sign(value) * deadzone) / (1 - deadzone))

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const pad = navigator.getGamepads?.()[index]
      bus.set('pad.connected', pad ? 1 : 0)
      if (!pad) return
      pad.axes.forEach((axis, axisIndex) => bus.set(`pad.axis.${axisIndex}`, curve(axis)))
      bus.set('pad.leftX', curve(pad.axes[0] ?? 0))
      bus.set('pad.leftY', curve(pad.axes[1] ?? 0))
      bus.set('pad.rightX', curve(pad.axes[2] ?? 0))
      bus.set('pad.rightY', curve(pad.axes[3] ?? 0))
      pad.buttons.forEach((button, buttonIndex) => bus.set(`pad.button.${buttonIndex}`, button.value || (button.pressed ? 1 : 0)))
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [bus, index, deadzone])

  return null
}

export default GamepadInput

export const feature: Feature = {
  id: 'input.gamepad',
  label: 'Gamepad',
  kind: 'app',
  group: 'Input',
  order: 15,
  enabled: false,
  description: 'pad.leftX/Y, pad.rightX/Y, pad.button.<n>',
  component: GamepadInput,
  controls: {
    index: { type: 'number', value: 0, min: 0, max: 3, step: 1 },
    deadzone: { type: 'number', value: 0.08, min: 0, max: 0.5, step: 0.01 },
  },
}
