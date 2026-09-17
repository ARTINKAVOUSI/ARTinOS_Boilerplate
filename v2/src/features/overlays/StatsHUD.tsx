import { useEffect, useRef, useState } from 'react'
import type { Feature } from '../../app/feature'
import { Sparkline } from '../../ui/Sparkline/Sparkline'
import './StatsHUD.css'

export interface RendererInfoSource {
  info?: { render?: { drawCalls?: number; triangles?: number }; memory?: { geometries?: number; textures?: number } }
}

export interface StatsHUDProps {
  /** Screen corner. */
  corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Frame-time budget line, ms. */
  budget?: number
  /** Provided by the app: the active renderer and backend. */
  renderer?: RendererInfoSource | null
  backend?: string | null
}

const SAMPLES = 90

/**
 * StatsHUD — frame rate, frame time history and renderer counters in a small
 * corner card. Frame time is measured on the main thread with rAF.
 */
export function StatsHUD({ corner = 'bottom-right', budget = 16.7, renderer, backend }: StatsHUDProps) {
  const history = useRef<number[]>([])
  const [snapshot, setSnapshot] = useState({ fps: 0, ms: 0, samples: [] as number[], calls: 0, triangles: 0, geometries: 0, textures: 0 })

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let frames = 0
    let windowStart = last
    const tick = (now: number) => {
      const dt = now - last
      last = now
      frames++
      history.current.push(dt)
      if (history.current.length > SAMPLES) history.current.shift()
      if (now - windowStart >= 250) {
        const info = renderer?.info
        const samples = history.current.slice()
        setSnapshot({
          fps: (frames * 1000) / (now - windowStart),
          ms: samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length),
          samples,
          calls: info?.render?.drawCalls ?? 0,
          triangles: info?.render?.triangles ?? 0,
          geometries: info?.memory?.geometries ?? 0,
          textures: info?.memory?.textures ?? 0,
        })
        frames = 0
        windowStart = now
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [renderer])

  const tone = snapshot.ms > budget * 1.5 ? 'warm' : 'live'
  const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n))

  return (
    <div className="stats-hud" data-corner={corner} aria-label="Performance">
      <div className="stats-hud__top">
        <b>{snapshot.fps.toFixed(0)}</b>
        <span>fps</span>
        <b>{snapshot.ms.toFixed(1)}</b>
        <span>ms</span>
        {backend && <em>{backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}</em>}
      </div>
      <Sparkline values={snapshot.samples} min={0} max={Math.max(budget * 2, 34)} threshold={budget} width={168} height={26} tone={tone} label="Frame time history" />
      <dl className="stats-hud__grid">
        <dt>Calls</dt>
        <dd>{compact(snapshot.calls)}</dd>
        <dt>Tris</dt>
        <dd>{compact(snapshot.triangles)}</dd>
        <dt>Geo</dt>
        <dd>{snapshot.geometries}</dd>
        <dt>Tex</dt>
        <dd>{snapshot.textures}</dd>
      </dl>
    </div>
  )
}

export default StatsHUD

export const feature: Feature = {
  id: 'overlay.stats',
  label: 'Stats HUD',
  kind: 'overlay',
  group: 'Diagnostics',
  order: 980,
  component: StatsHUD,
  controls: {
    corner: { type: 'select', value: 'bottom-right', options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
    budget: { type: 'number', value: 16.7, min: 4, max: 50, step: 0.1, unit: 'ms' },
  },
}
