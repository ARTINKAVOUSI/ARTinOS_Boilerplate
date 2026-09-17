import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useArtinosRuntime } from './runtime'
import type { QualityTier } from '../core/quality'

/** Frame rate is judged over windows, not single frames: V-sync makes frame times alternate (e.g. 17/33 ms). */
const WINDOW_S = 0.5
/** Consecutive slow windows before stepping down (1 s). */
const DOWNSHIFT_WINDOWS = 2
/** Consecutive fast windows before stepping up (5 s). */
const UPSHIFT_WINDOWS = 10

const downTier = (scalar: number): QualityTier => scalar < .58 ? 'low' : scalar < .82 ? 'balanced' : 'high'
// Recovery thresholds sit above the downshift ones so a tier is not re-entered the moment it was
// left. Automatic control tops out at 'high'; 'ultra' is a deliberate, manual choice.
const upTier = (scalar: number): QualityTier => scalar > .86 ? 'high' : scalar > .62 ? 'balanced' : 'low'

export function AdaptiveQuality() {
  const runtime = useArtinosRuntime()
  const samples = useRef({ time: 0, frames: 0, slow: 0, fast: 0 })
  useFrame((_state: unknown, delta: number) => {
    const q = runtime.quality.getState()
    if (q.mode !== 'auto' || !(delta > 0)) return
    const w = samples.current
    // a single long stall (shader compile, tab switch) must not dominate the window
    w.time += Math.min(delta, .25)
    w.frames++
    if (w.time < WINDOW_S) return
    const fps = w.frames / w.time
    w.time = 0
    w.frames = 0
    if (fps < q.targetFps * .78) { w.slow++; w.fast = 0 }
    else if (fps > q.targetFps * .96) { w.fast++; w.slow = 0 }
    else { w.slow = 0; w.fast = 0 }
    if (w.slow >= DOWNSHIFT_WINDOWS && q.scalar > .4) {
      const scalar = Math.max(.4, q.scalar - .08)
      runtime.quality.setState({ scalar, tier: downTier(scalar) })
      runtime.telemetry.set('quality.reason', 'performance-downshift', { group: 'runtime' })
      w.slow = 0
    }
    if (w.fast >= UPSHIFT_WINDOWS && q.scalar < 1) {
      const scalar = Math.min(1, q.scalar + .05)
      runtime.quality.setState({ scalar, tier: upTier(scalar) })
      runtime.telemetry.set('quality.reason', 'performance-recovery', { group: 'runtime' })
      w.fast = 0
    }
  })
  return null
}
