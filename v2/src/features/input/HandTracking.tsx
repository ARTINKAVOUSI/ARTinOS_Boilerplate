import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from './signals'

export interface HandTrackingProps {
  children?: ReactNode
  /** Turning this on asks for the camera. */
  enabled?: boolean
  /** Hands to track, 1–2. */
  maxHands?: number
  /** Show a small mirrored camera preview with landmarks. */
  preview?: boolean
  /** Where the MediaPipe WASM files are served from. */
  wasmPath?: string
  /** URL of `hand_landmarker.task`. */
  modelPath?: string
  /** Detection rate cap. */
  fps?: number
}

const TIPS = [4, 8, 12, 16, 20]

/**
 * HandTracking — webcam hand landmarks via MediaPipe Tasks, published as
 * signals (all normalised, x/y in −1…1 with y up, mirrored like a selfie):
 * `hand.count`, `hand.<i>.x`, `hand.<i>.y`, `hand.<i>.pinch` (0 open … 1 closed),
 * `hand.<i>.open` (spread of the fingers, 0…1).
 *
 * Requires `@mediapipe/tasks-vision` and the model + WASM files served
 * locally (defaults: `/mediapipe/wasm`, `/mediapipe/models/hand_landmarker.task`).
 */
export function HandTracking({
  children,
  enabled = false,
  maxHands = 1,
  preview = true,
  wasmPath = '/mediapipe/wasm',
  modelPath = '/mediapipe/models/hand_landmarker.task',
  fps = 30,
}: HandTrackingProps) {
  const bus = useSignals()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'off' | 'loading' | 'on' | 'error'>('off')
  useSignalCleanup('hand')

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      return
    }
    let cancelled = false
    let cleanup = () => {}
    setStatus('loading')

    ;(async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(wasmPath)
      const landmarker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: maxHands,
      })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop())
        landmarker.close()
        return
      }
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()

      let frame = 0
      let last = 0
      const smooth = new Map<string, number>()
      const ease = (key: string, value: number, k = 0.5) => {
        const next = (smooth.get(key) ?? value) + (value - (smooth.get(key) ?? value)) * k
        smooth.set(key, next)
        bus.set(key, next)
      }

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick)
        if (now - last < 1000 / fps || video.readyState < 2) return
        last = now
        const result = landmarker.detectForVideo(video, now)
        const hands = result.landmarks ?? []
        bus.set('hand.count', hands.length)
        hands.forEach((points, i) => {
          const wrist = points[0]
          const middle = points[9]
          const scale = Math.hypot(middle.x - wrist.x, middle.y - wrist.y) || 1
          const pinch = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) / scale
          const spread = TIPS.reduce((sum, tip) => sum + Math.hypot(points[tip].x - wrist.x, points[tip].y - wrist.y), 0) / TIPS.length / scale
          ease(`hand.${i}.x`, -(middle.x * 2 - 1))
          ease(`hand.${i}.y`, -(middle.y * 2 - 1))
          ease(`hand.${i}.pinch`, Math.min(1, Math.max(0, 1 - (pinch - 0.15) / 0.6)), 0.6)
          ease(`hand.${i}.open`, Math.min(1, Math.max(0, (spread - 0.9) / 1.1)), 0.4)
        })

        const view = canvas.current
        const context = view?.getContext('2d')
        if (view && context) {
          context.save()
          context.clearRect(0, 0, view.width, view.height)
          context.translate(view.width, 0)
          context.scale(-1, 1)
          context.globalAlpha = 0.85
          context.drawImage(video, 0, 0, view.width, view.height)
          context.globalAlpha = 1
          context.fillStyle = '#6fe3c0'
          for (const points of hands) {
            for (const p of points) {
              context.beginPath()
              context.arc(p.x * view.width, p.y * view.height, 2, 0, Math.PI * 2)
              context.fill()
            }
          }
          context.restore()
        }
      }
      frame = requestAnimationFrame(tick)
      setStatus('on')

      cleanup = () => {
        cancelAnimationFrame(frame)
        stream.getTracks().forEach(track => track.stop())
        video.srcObject = null
        landmarker.close()
      }
    })().catch(error => {
      if (cancelled) return
      console.warn('[hands] tracking unavailable', error)
      setStatus('error')
    })

    return () => {
      cancelled = true
      cleanup()
      bus.delete('hand')
    }
  }, [bus, enabled, maxHands, wasmPath, modelPath, fps])

  return (
    <>
      {children}
      {enabled && preview && (
        <div
          style={{
            position: 'fixed',
            left: 16,
            bottom: 16,
            zIndex: 20,
            width: 160,
            borderRadius: 10,
            overflow: 'hidden',
            background: 'rgba(0,0,0,.4)',
            boxShadow: '0 10px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.14)',
            font: '10px system-ui, sans-serif',
            color: 'rgba(255,255,255,.7)',
            pointerEvents: 'none',
          }}
        >
          <canvas ref={canvas} width={160} height={120} style={{ display: 'block', width: 160, height: 120 }} />
          <div style={{ padding: '4px 8px' }}>Hands · {status}</div>
        </div>
      )}
    </>
  )
}

export default HandTracking

export const feature: Feature = {
  id: 'input.hands',
  label: 'Hand Tracking',
  kind: 'app',
  group: 'Input',
  order: 13,
  enabled: true,
  description: 'hand.count, hand.<i>.x / y / pinch / open from the webcam',
  component: HandTracking,
  controls: {
    enabled: { type: 'boolean', value: false, label: 'Camera' },
    maxHands: { type: 'number', value: 1, min: 1, max: 2, step: 1, label: 'Hands' },
    preview: { type: 'boolean', value: true },
    fps: { type: 'number', value: 30, min: 5, max: 60, step: 1, label: 'Rate' },
  },
}
