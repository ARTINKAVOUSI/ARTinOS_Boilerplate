import { useEffect, type ReactNode } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'

export interface PointerInputProps {
  children?: ReactNode
  /** How quickly `pointer.speed` decays when the pointer stops, per second. */
  decay?: number
}

/**
 * PointerInput — publishes the mouse/touch position as signals:
 * `pointer.x`, `pointer.y` (−1…1, y up), `pointer.speed` (screens/s),
 * `pointer.down` (0/1) and `pointer.wheel` (accumulated).
 */
export function PointerInput({ children, decay = 6 }: PointerInputProps) {
  const bus = useSignals()
  useSignalCleanup('pointer')

  useEffect(() => {
    let lastX = 0
    let lastY = 0
    let lastTime = performance.now()
    let speed = 0
    let wheel = 0
    let frame = 0

    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -((event.clientY / window.innerHeight) * 2 - 1)
      const now = performance.now()
      const dt = Math.max(1, now - lastTime) / 1000
      speed = Math.max(speed, Math.hypot(x - lastX, y - lastY) / 2 / dt)
      lastX = x
      lastY = y
      lastTime = now
      bus.set('pointer.x', x)
      bus.set('pointer.y', y)
    }
    const onDown = () => bus.set('pointer.down', 1)
    const onUp = () => bus.set('pointer.down', 0)
    const onWheel = (event: WheelEvent) => {
      wheel += event.deltaY / 1000
      bus.set('pointer.wheel', wheel)
    }
    let previous = performance.now()
    const tick = (now: number) => {
      const dt = (now - previous) / 1000
      previous = now
      speed *= Math.exp(-decay * dt)
      bus.set('pointer.speed', speed)
      frame = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frame)
    }
  }, [bus, decay])

  return <>{children}</>
}

export default PointerInput

export const feature: Feature = {
  id: 'input.pointer',
  label: 'Pointer',
  kind: 'app',
  group: 'Input',
  order: 10,
  description: 'pointer.x / y / speed / down / wheel',
  component: PointerInput,
  controls: {
    decay: { type: 'number', value: 6, min: 0.5, max: 20, step: 0.1, label: 'Speed decay' },
  },
}
