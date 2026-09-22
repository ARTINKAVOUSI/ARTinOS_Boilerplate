import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { compactNumber, useRuntime } from '../runtime'
import { studio, useFeatureState } from '../store'
import { Icons } from './icons'

/** Resolution tiers map onto the Render feature's pixel-ratio ceiling. */
const TIERS = [
  { id: 'low', ratio: 0.6 },
  { id: 'balanced', ratio: 1 },
  { id: 'high', ratio: 1.5 },
  { id: 'ultra', ratio: 2 },
] as const
const TARGET_FPS = 60

const polyline = (values: number[], width: number, baseline: number, span: number, ceiling?: number) => {
  if (values.length < 2) return ''
  const max = ceiling ?? Math.max(...values, 1)
  return values.map((value, index) => `${((index / (values.length - 1)) * width).toFixed(1)},${(baseline - (Math.min(max, value) / max) * span).toFixed(1)}`).join(' ')
}

/**
 * Always-visible performance readout in the dock strip. Opens a popover with
 * the frame profile, renderer load and the resolution tier.
 */
export function RuntimeHUD() {
  const stats = useRuntime()
  const render = useFeatureState('scene.render')
  const [open, setOpen] = useState(false)
  const hud = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<CSSProperties>({})

  const fps = Math.round(stats.fps)
  const health = fps >= TARGET_FPS * 0.9 ? 'good' : fps >= TARGET_FPS * 0.65 ? 'warn' : 'bad'
  const ratio = Number(render?.values.maxPixelRatio ?? 2)
  const tier = [...TIERS].reverse().find(entry => ratio >= entry.ratio)?.id ?? 'low'
  const budget = Math.round((stats.frameMs / (1000 / TARGET_FPS)) * 100)
  const frames = stats.history.slice(-48)

  useEffect(() => {
    if (!open) return
    const dock = hud.current?.closest<HTMLElement>('.mb-group')
    if (!dock) return
    const update = () => {
      const rect = dock.getBoundingClientRect()
      setAnchor({ left: rect.left + 8, width: rect.width - 16, top: Math.max(8, rect.top - 84) })
    }
    update()
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.artinos-hud, .artinos-hud-popover')) setOpen(false)
    }
    window.addEventListener('resize', update)
    window.addEventListener('pointerdown', close)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('pointerdown', close)
    }
  }, [open])

  const popover = (
    <div className="artinos-hud-popover is-dock-bar" data-dock="bottom" style={anchor}>
      <header>
        <span>
          {Icons.activity}
          <b>PERFORMANCE</b>
        </span>
        <em className={`is-${health}`}>{health === 'good' ? 'stable' : health === 'warn' ? 'strained' : 'limited'}</em>
      </header>
      <div className="artinos-hud-hero">
        <div>
          <strong>{fps}</strong>
          <small>FPS</small>
        </div>
        <svg viewBox="0 0 180 44" preserveAspectRatio="none">
          <polyline points={polyline(stats.fpsHistory, 180, 42, 38)} />
        </svg>
        <span>
          <b>{stats.frameMs.toFixed(2)} ms</b>
          <small>{budget}% frame budget</small>
        </span>
      </div>
      <div className="artinos-hud-detail-grid">
        <span>
          {Icons.activity}
          <small>Backend</small>
          <b>{stats.backend === 'webgpu' ? 'WebGPU' : stats.backend === 'webgl2' ? 'WebGL2' : '—'}</b>
        </span>
        <span>
          {Icons.maximize}
          <small>Resolution</small>
          <b>
            {stats.renderer.width}×{stats.renderer.height} · {stats.renderer.pixelRatio.toFixed(2)}×
          </b>
        </span>
        <span>
          {Icons.sparkles}
          <small>Render</small>
          <b>
            {compactNumber(stats.renderer.calls)} calls · {compactNumber(stats.renderer.triangles)} tris
          </b>
        </span>
        <span>
          {Icons.timer}
          <small>Memory</small>
          <b>
            {stats.renderer.geometries} geometries · {stats.renderer.textures} textures
          </b>
        </span>
      </div>
      <div className="artinos-hud-governor">
        <span>
          <b>QUALITY</b>
          <small>pixel ratio ≤ {ratio.toFixed(2)}</small>
        </span>
        <div>
          {TIERS.map(entry => (
            <button key={entry.id} type="button" className={tier === entry.id ? 'is-active' : ''} onClick={() => studio.setValue('scene.render', 'maxPixelRatio', entry.ratio)}>
              {entry.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={hud} className={`artinos-hud is-embedded ${open ? 'is-open' : ''} heat-${health}`} aria-label="Runtime telemetry">
      <button type="button" className="artinos-hud-summary" onClick={() => setOpen(value => !value)} aria-expanded={open} title="Open performance monitor">
        <span className="artinos-hud-backend">
          <i className={fps > 0 ? 'is-live' : ''} />
          <b>{stats.backend ?? 'GPU'}</b>
        </span>
        <span className="artinos-hud-readout hud-fps" title={`${fps} frames per second`}>
          <strong>{fps}</strong>
          <small>fps</small>
        </span>
        <svg className="artinos-hud-micrograph" viewBox="0 0 54 16" aria-hidden="true">
          <polyline className="is-cpu" points={polyline(frames, 54, 14, 12, 50)} />
        </svg>
        <span className="artinos-hud-readout hud-frame" title={`${stats.frameMs.toFixed(2)} milliseconds per frame`}>
          <strong>{stats.frameMs.toFixed(1)}</strong>
          <small>ms</small>
        </span>
        <span className={`artinos-hud-quality quality-${tier}`} title={`Pixel ratio ceiling ${ratio}`}>
          <small>tier</small>
          <b>{tier}</b>
        </span>
        <span className="artinos-hud-chevron">{Icons.chevronDown}</span>
      </button>
      {open && createPortal(popover, document.body)}
    </div>
  )
}
