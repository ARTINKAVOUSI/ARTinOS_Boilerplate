import { useEffect, useRef } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'

export interface OrientationInputProps {
  /** How fast the values ease towards the device reading, per second. */
  smoothing?: number
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }

const AXES = ['alpha', 'beta', 'gamma'] as const
const AXIS_KEYS = ['tilt.alpha', 'tilt.beta', 'tilt.gamma'] as const

/**
 * OrientationInput — publishes device tilt as signals:
 *
 *   `tilt.alpha`  compass heading, 0…1 (0 = north)
 *   `tilt.beta`   front-to-back, −1…1
 *   `tilt.gamma`  left-to-right, −1…1
 *   `tilt.active` 1 once readings arrive
 *
 * iOS needs a user gesture to grant the sensor, so the first tap on the page
 * asks for it. Nothing is published until the first reading arrives, so a
 * desktop without sensors publishes nothing.
 */
export function OrientationInput({ smoothing = 6 }: OrientationInputProps) {
  const bus = useSignals()
  useSignalCleanup('tilt')
  // Read by the loop, so a smoothing change never re-asks for the sensor.
  const ease = useRef(smoothing)
  ease.current = smoothing

  useEffect(() => {
    let frame = 0
    let stopped = false
    let previous = performance.now()
    const target = { alpha: 0, beta: 0, gamma: 0 }
    const current = { alpha: 0, beta: 0, gamma: 0 }
    let active = false

    const onOrientation = (event: DeviceOrientationEvent) => {
      // Desktop browsers may send one event with every angle null: that means no sensor.
      if (event.alpha === null && event.beta === null && event.gamma === null) return
      active = true
      target.alpha = ((event.alpha ?? 0) % 360) / 360
      target.beta = Math.max(-1, Math.min(1, (event.beta ?? 0) / 90))
      target.gamma = Math.max(-1, Math.min(1, (event.gamma ?? 0) / 90))
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      if (!active) return
      const k = 1 - Math.exp(-ease.current * dt)
      for (let i = 0; i < AXES.length; i++) {
        const axis = AXES[i]
        current[axis] += (target[axis] - current[axis]) * k
        bus.set(AXIS_KEYS[i], current[axis])
      }
      bus.set('tilt.active', 1)
    }

    // The iOS permission can resolve after unmount; `stopped` keeps that from adding a listener.
    const listen = () => {
      if (!stopped) window.addEventListener('deviceorientation', onOrientation)
    }
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
      stopped = true
      cancelAnimationFrame(frame)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('pointerdown', ask)
    }
  }, [bus])

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
