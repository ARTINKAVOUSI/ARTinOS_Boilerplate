import { useEffect, useState } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'
import { webcam } from '../../app/webcam'

export interface CameraInputProps {
  /** Analysis resolution. Small is plenty: this runs every frame on the CPU. */
  resolution?: number
  /** How often to sample, in hertz. */
  rate?: number
  /** How fast the values ease towards the reading, per second. */
  smoothing?: number
}

/**
 * CameraInput — opens the webcam once and publishes what it sees:
 *
 *   `camera.luma`     0…1 average brightness
 *   `camera.motion`   0…1 frame-to-frame change
 *   `camera.r/g/b`    0…1 average colour
 *   `camera.active`   1 while the stream is live
 *
 * The video element is shared through `webcam`, so Media Plane can show the
 * same stream without opening the camera again. Permission is asked for on
 * mount; a refusal publishes nothing and logs once.
 */
export function CameraInput({ resolution = 64, rate = 20, smoothing = 8 }: CameraInputProps) {
  const bus = useSignals()
  const [error, setError] = useState<string | null>(null)
  useSignalCleanup('camera')

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let frame = 0
    let lastAt = 0
    let previousPixels: Uint8ClampedArray | null = null
    const smoothed = { luma: 0, motion: 0, r: 0, g: 0, b: 0 }
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    const canvas = document.createElement('canvas')
    canvas.width = resolution
    canvas.height = resolution
    const context = canvas.getContext('2d', { willReadFrequently: true })

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (!context || video.readyState < 2 || now - lastAt < 1000 / rate) return
      const dt = Math.min(0.5, (now - lastAt) / 1000)
      lastAt = now
      context.drawImage(video, 0, 0, resolution, resolution)
      const { data } = context.getImageData(0, 0, resolution, resolution)
      let luma = 0
      let red = 0
      let green = 0
      let blue = 0
      let motion = 0
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        red += r
        green += g
        blue += b
        luma += 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (previousPixels) motion += Math.abs(r - previousPixels[index]) + Math.abs(g - previousPixels[index + 1]) + Math.abs(b - previousPixels[index + 2])
      }
      const pixels = data.length / 4
      previousPixels = data.slice()
      const k = 1 - Math.exp(-smoothing * dt)
      const target = { luma: luma / pixels / 255, motion: Math.min(1, motion / pixels / 255 / 3 * 8), r: red / pixels / 255, g: green / pixels / 255, b: blue / pixels / 255 }
      for (const key of ['luma', 'motion', 'r', 'g', 'b'] as const) {
        smoothed[key] += (target[key] - smoothed[key]) * k
        bus.set(`camera.${key}`, smoothed[key])
      }
      bus.set('camera.active', 1)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then(granted => {
        if (stopped) {
          granted.getTracks().forEach(track => track.stop())
          return
        }
        stream = granted
        video.srcObject = granted
        void video.play()
        webcam.set(video)
        frame = requestAnimationFrame(tick)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      webcam.set(null)
      video.srcObject = null
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [bus, resolution, rate, smoothing])

  useEffect(() => {
    if (error) console.warn(`[input.camera] ${error}`)
  }, [error])

  return null
}

export default CameraInput

export const feature: Feature = {
  id: 'input.camera',
  label: 'Camera',
  kind: 'app',
  group: 'Input',
  order: 17,
  enabled: false,
  description: 'camera.luma, camera.motion, camera.r/g/b from the webcam',
  component: CameraInput,
  controls: {
    resolution: { type: 'number', value: 64, min: 16, max: 256, step: 8, unit: 'px' },
    rate: { type: 'number', value: 20, min: 1, max: 60, step: 1, unit: 'hz' },
    smoothing: { type: 'number', value: 8, min: 1, max: 30, step: 0.5 },
  },
}
