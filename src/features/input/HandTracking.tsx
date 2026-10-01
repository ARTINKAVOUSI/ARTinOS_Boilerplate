import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'

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

// Signal names per hand index, built once rather than every frame.
const handKeys: { x: string; y: string; pinch: string; open: string }[] = []
const keysFor = (i: number) => (handKeys[i] ??= { x: `hand.${i}.x`, y: `hand.${i}.y`, pinch: `hand.${i}.pinch`, open: `hand.${i}.open` })

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
  // Read by the loop: a rate or hand-count change never restarts the camera and the model.
  const live = useRef({ fps, maxHands })
  live.current.fps = fps
  live.current.maxHands = maxHands

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      return
    }
    let cancelled = false
    // Each resource registers its release as soon as it exists, so a cancel during any await
    // frees exactly what was acquired; whatever an await returns after a cancel is freed on the spot.
    const releases: Array<() => void> = []
    const cleanup = () => {
      while (releases.length) releases.pop()!()
    }
    setStatus('loading')

    ;(async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      if (cancelled) return
      const files = await FilesetResolver.forVisionTasks(wasmPath)
      if (cancelled) return
      let numHands = live.current.maxHands
      const landmarker = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands,
      })
      if (cancelled) {
        landmarker.close()
        return
      }
      releases.push(() => landmarker.close())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      if (cancelled) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      releases.push(() => stream.getTracks().forEach(track => track.stop()))
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      releases.push(() => {
        video.srcObject = null
      })
      await video.play()
      if (cancelled) return

      let frame = 0
      let last = 0
      const smooth = new Map<string, number>()
      const ease = (key: string, value: number, k = 0.5) => {
        const from = smooth.get(key) ?? value
        const next = from + (value - from) * k
        smooth.set(key, next)
        bus.set(key, next)
      }

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick)
        if (now - last < 1000 / live.current.fps || video.readyState < 2) return
        last = now
        // numHands is a model option: apply it in place rather than rebuilding the landmarker.
        if (live.current.maxHands !== numHands) {
          numHands = live.current.maxHands
          void landmarker.setOptions({ numHands })
          // Clear what the previous count published, as a restart would have.
          smooth.clear()
          bus.delete('hand')
        }
        const result = landmarker.detectForVideo(video, now)
        const hands = result.landmarks ?? []
        bus.set('hand.count', hands.length)
        for (let i = 0; i < hands.length; i++) {
          const points = hands[i]
          const wrist = points[0]
          const middle = points[9]
          const scale = Math.hypot(middle.x - wrist.x, middle.y - wrist.y) || 1
          const pinch = Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y) / scale
          let reach = 0
          for (let t = 0; t < TIPS.length; t++) reach += Math.hypot(points[TIPS[t]].x - wrist.x, points[TIPS[t]].y - wrist.y)
          const spread = reach / TIPS.length / scale
          const keys = keysFor(i)
          ease(keys.x, -(middle.x * 2 - 1))
          ease(keys.y, -(middle.y * 2 - 1))
          ease(keys.pinch, Math.min(1, Math.max(0, 1 - (pinch - 0.15) / 0.6)), 0.6)
          ease(keys.open, Math.min(1, Math.max(0, (spread - 0.9) / 1.1)), 0.4)
        }

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
      releases.push(() => cancelAnimationFrame(frame))
      setStatus('on')
    })().catch(error => {
      if (cancelled) return
      // Free whatever was acquired before the failure (a model without a camera, say).
      cleanup()
      console.warn('[hands] tracking unavailable', error)
      setStatus('error')
    })

    return () => {
      cancelled = true
      cleanup()
      bus.delete('hand')
    }
  }, [bus, enabled, wasmPath, modelPath])

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
