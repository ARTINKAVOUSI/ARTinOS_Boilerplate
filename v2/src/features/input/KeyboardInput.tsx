import { useEffect, type ReactNode } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from './signals'

export interface KeyboardInputProps {
  children?: ReactNode
  /** How fast the WASD axes ease towards their target, per second. */
  smoothing?: number
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * KeyboardInput — publishes `key.<code>` (0/1, e.g. `key.Space`) and two
 * smoothed axes from WASD / arrow keys: `keys.axisX`, `keys.axisY` (−1…1).
 * Keys typed into text fields are ignored.
 */
export function KeyboardInput({ children, smoothing = 10 }: KeyboardInputProps) {
  const bus = useSignals()
  useSignalCleanup('key')
  useSignalCleanup('keys')

  useEffect(() => {
    const held = new Set<string>()
    let ax = 0
    let ay = 0
    let frame = 0
    let previous = performance.now()

    const onDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      held.add(event.code)
      bus.set(`key.${event.code}`, 1)
    }
    const onUp = (event: KeyboardEvent) => {
      held.delete(event.code)
      bus.set(`key.${event.code}`, 0)
    }
    const onBlur = () => {
      for (const code of held) bus.set(`key.${code}`, 0)
      held.clear()
    }
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      const tx = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0)
      const ty = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0)
      const k = 1 - Math.exp(-smoothing * dt)
      ax += (tx - ax) * k
      ay += (ty - ay) * k
      bus.set('keys.axisX', ax)
      bus.set('keys.axisY', ay)
      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      cancelAnimationFrame(frame)
    }
  }, [bus, smoothing])

  return <>{children}</>
}

export default KeyboardInput

export const feature: Feature = {
  id: 'input.keyboard',
  label: 'Keyboard',
  kind: 'app',
  group: 'Input',
  order: 11,
  description: 'key.<code>, keys.axisX / axisY (WASD)',
  component: KeyboardInput,
  controls: {
    smoothing: { type: 'number', value: 10, min: 1, max: 40, step: 0.5 },
  },
}
