import { useEffect } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'

export interface OrientationInputProps {
  /** How fast the values ease towards the device reading, per second. */
  smoothing?: number
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }

/**
 * OrientationInput — publishes device tilt as signals:
 *
 *   `tilt.alpha`  compass heading, 0…1 (0 = north)
 *   `tilt.beta`   front-to-back, −1…1
 *   `tilt.gamma`  left-to-right, −1…1
 *   `tilt.active` 1 once readings arrive
 *
 * iOS needs a user gesture to grant the sensor, so the first tap on the page
 * asks for it. A desktop without sensors simply publishes nothing.
 */
export function OrientationInput({ smoothing = 6 }: OrientationInputProps) {
  const bus = useSignals()
  useSignalCleanup('tilt')

  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const target = { alpha: 0, beta: 0, gamma: 0 }
    const current = { alpha: 0, beta: 0, gamma: 0 }
    let active = 0

    const onOrientation = (event: DeviceOrientationEvent) => {
      active = 1
      target.alpha = ((event.alpha ?? 0) % 360) / 360
      target.beta = Math.max(-1, Math.min(1, (event.beta ?? 0) / 90))
      target.gamma = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 90))
    }

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      const k = 1 - Math.exp(-smoothing * dt)
      for (const axis of ['alpha', 'beta', 'gamma'] as const) {
        current[axis] += (target[axis] - current[axis]) * k
        bus.set(`tilt.${axis}`, current[axis])
      }
      bus.set('tilt.active', active)
      frame = requestAnimationFrame(tick)
    }

    const listen = () => window.addEventListener('deviceorientation', onOrientation)
    const ask = () => {
      const api = DeviceOrientationEvent as unknown as PermissionApi
      if (!api.requestPermission) return listen()
      void api.requestPermission().then(result => result === 'granted' && listen())
    }
    // iOS only grants the sensor from a gesture; elsewhere this listener never fires anything extra.
    window.addEventListener('pointerdown', ask, { once: true })
    if (!(DeviceOrientationEvent as unknown as PermissionApi).requestPermission) listen()
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('pointerdown', ask)
    }
  }, [bus, smoothing])

  return null
}

export default OrientationInput

export const feature: Feature = {
  id: 'input.orientation',
  label: 'Device Tilt',
  kind: 'app',
  group: 'Input',
  order: 16,
  enabled: false,
  description: 'tilt.alpha / beta / gamma from the device sensors',
  component: OrientationInput,
  controls: {
    smoothing: { type: 'number', value: 6, min: 1, max: 30, step: 0.5 },
  },
}
