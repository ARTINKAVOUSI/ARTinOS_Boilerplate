import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ChevronDown, Cpu, Layers, Monitor, Timer } from 'lucide-react'
import { useArtinosRuntime, type FrameProfileResource } from '@artinos/runtime'
import { useQuality, useTelemetry } from '../hooks'
import { useWorkspaceTheme } from '@artinos/ui'
import { compactNumber } from '@artinos/ui'

const TIERS = ['low', 'balanced', 'high', 'ultra'] as const
const TIER_SCALARS: Record<(typeof TIERS)[number], number> = { low: 0.5, balanced: 0.72, high: 0.88, ultra: 1 }
const GRAPH_SAMPLES = 48

/** Always-visible performance readout, expanding into a detailed governor popover. */
export function RuntimeHUD({ embedded = false }: { embedded?: boolean }) {
  const runtime = useArtinosRuntime()
  const metrics = useTelemetry()
  const quality = useQuality()
  const { theme, backdrop } = useWorkspaceTheme()
  const [open, setOpen] = useState(false)
  const hudRef = useRef<HTMLDivElement>(null)

  const read = (id: string) => metrics.find(metric => metric.id === id)?.value
  const profile = runtime.resources.get<FrameProfileResource>('telemetry.frameProfile')?.current
  const gpuAvailable = read('performance.gpuTimestamp') === true

  const fps = Math.round(Number(read('performance.fps') ?? 0))
  const frameMs = Number(read('performance.frameMs') ?? 0)
  const cpuLoad = Number(read('performance.cpuLoad') ?? 0)
  const gpuMetric = read('performance.gpuLoad')
  const gpuLoad = !gpuAvailable || gpuMetric == null ? null : Number(gpuMetric)
  const errors = Number(read('runtime.errors') ?? 0)

  const series = (graph: number[] | undefined, metric: string) => (graph?.length ? graph : runtime.telemetry.history(metric)).slice(-GRAPH_SAMPLES)
  const fpsHistory = series(profile?.graph.fps, 'performance.fps')
  const cpuHistory = series(profile?.graph.cpu, 'performance.cpuLoad')
  const gpuHistory = gpuAvailable ? series(profile?.graph.gpu, 'performance.gpuLoad') : []

  const health = fps >= quality.targetFps * 0.9 ? 'good' : fps >= quality.targetFps * 0.65 ? 'warn' : 'bad'
  const anchor = useDockAnchor(hudRef, open && embedded)

  const popover = (
    <div className={`artinos-hud-popover ${embedded ? 'is-dock-bar' : ''}`} data-theme={theme} data-backdrop={backdrop} data-dock={anchor.dock} style={embedded ? anchor.style : undefined}>
      <header>
        <span>
          <Activity size={14} />
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
          <polyline points={polyline(fpsHistory, 180, 42, 38)} />
        </svg>
        <span>
          <b>{frameMs.toFixed(2)} ms</b>
          <small>{Math.round(Number(read('performance.frameLoad') ?? 0))}% frame budget</small>
        </span>
      </div>

      <div className="artinos-hud-detail-grid">
        <span title="Measured by the Three RendererInspector">
          <Cpu size={12} />
          <small>CPU render</small>
          <b>
            {Math.round(cpuLoad)}% · {Number(read('performance.cpuMs') ?? 0).toFixed(2)} ms
          </b>
        </span>
        <span title="WebGPU timestamp query only; never a synthetic estimate">
          <Activity size={12} />
          <small>GPU render</small>
          <b>{gpuLoad == null ? 'timestamp unavailable' : `${Math.round(gpuLoad)}% · ${Number(read('performance.gpuMs') ?? 0).toFixed(2)} ms`}</b>
        </span>
        <span title="Drawing-buffer resolution">
          <Monitor size={12} />
          <small>Resolution</small>
          <b>
            {String(read('renderer.resolution') ?? '—')} · {Number(read('renderer.dpr') ?? 1).toFixed(2)}×
          </b>
        </span>
        <span title="Current renderer workload">
          <Layers size={12} />
          <small>Render</small>
          <b>
            {compactNumber(Number(read('renderer.calls') ?? 0))} calls · {compactNumber(Number(read('renderer.triangles') ?? 0))} tris
          </b>
        </span>
      </div>

      <div className="artinos-hud-governor">
        <span>
          <b>QUALITY</b>
          <small>
            {quality.mode} · target {quality.targetFps} fps
          </small>
        </span>
        <div>
          <button className={quality.mode === 'auto' ? 'is-active' : ''} onClick={() => runtime.quality.setState({ mode: 'auto' })}>
            Auto
          </button>
          {TIERS.map(tier => (
            <button
              key={tier}
              className={quality.mode === 'manual' && quality.tier === tier ? 'is-active' : ''}
              onClick={() => runtime.quality.setState({ tier, scalar: TIER_SCALARS[tier], mode: 'manual' })}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div
      ref={hudRef}
      className={`artinos-hud ${embedded ? 'is-embedded' : ''} ${open ? 'is-open' : ''} ${errors ? 'has-errors' : ''} heat-${health}`}
      aria-label="Runtime telemetry"
    >
      <button className="artinos-hud-summary" onClick={() => setOpen(value => !value)} aria-expanded={open} title="Open performance monitor">
        <span className="artinos-hud-backend">
          <i className={fps > 0 ? 'is-live' : ''} />
          <b>{String(read('renderer.backend') ?? 'GPU')}</b>
        </span>
        <span className="artinos-hud-readout hud-fps" title={`${fps} frames per second`}>
          <strong>{fps}</strong>
          <small>fps</small>
        </span>
        <span className="artinos-hud-load" title="RendererInspector CPU timing and WebGPU timestamp queries">
          <small>CPU</small>
          <b>{Math.round(cpuLoad)}%</b>
          <small>GPU</small>
          <b>{gpuLoad == null ? '—' : `${Math.round(gpuLoad)}%`}</b>
        </span>
        <MicroGraph cpu={cpuHistory} gpu={gpuHistory} />
        <span className="artinos-hud-readout hud-frame" title={`${frameMs.toFixed(2)} milliseconds per frame`}>
          <Timer size={10} />
          <strong>{frameMs.toFixed(1)}</strong>
          <small>ms</small>
        </span>
        <span
          className={`artinos-hud-quality quality-${quality.mode === 'auto' ? 'auto' : quality.tier}`}
          title={`${quality.mode} quality · ${quality.tier} · ${Math.round(quality.scalar * 100)}% resolution scale`}
        >
          <small>{quality.mode}</small>
          <b>{quality.tier}</b>
        </span>
        <ChevronDown className="artinos-hud-chevron" size={11} />
        {errors > 0 && <span className="artinos-hud-errors">{errors}</span>}
      </button>
      {open && (embedded ? createPortal(popover, document.body) : popover)}
    </div>
  )
}

function polyline(values: number[], width: number, baseline: number, span: number): string {
  if (!values.length) return ''
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  return values.map((value, index) => `${values.length < 2 ? 0 : (index / (values.length - 1)) * width},${baseline - ((value - min) / (max - min || 1)) * span}`).join(' ')
}

function MicroGraph({ cpu, gpu }: { cpu: number[]; gpu: number[] }) {
  const ceiling = Math.max(...cpu, ...gpu, 1)
  const points = (values: number[]) =>
    values.map((value, index) => `${values.length < 2 ? 0 : (index / (values.length - 1)) * 54},${14 - (Math.min(ceiling, value) / ceiling) * 12}`).join(' ')
  return (
    <svg className="artinos-hud-micrograph" viewBox="0 0 54 16" aria-hidden="true">
      <polyline className="is-cpu" points={points(cpu)} />
      <polyline className={`is-gpu ${gpu.length ? '' : 'is-unavailable'}`} points={gpu.length ? points(gpu) : '0,13 54,13'} />
    </svg>
  )
}

/**
 * Positions the embedded popover beside its dock.
 *
 * The popover is portalled to `document.body` to escape the dock's overflow clipping, so
 * it has to be positioned manually against the dock rect it logically belongs to.
 */
function useDockAnchor(hudRef: React.RefObject<HTMLDivElement | null>, active: boolean) {
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [dock, setDock] = useState<'bottom' | 'left' | 'right'>('bottom')

  useEffect(() => {
    if (!active) return
    const element = hudRef.current?.closest<HTMLElement>('.artinos-dock')
    if (!element) return
    const mode = element.classList.contains('artinos-dock-left') ? 'left' : element.classList.contains('artinos-dock-right') ? 'right' : 'bottom'
    setDock(mode)

    const update = () => {
      const rect = element.getBoundingClientRect()
      if (mode === 'bottom') {
        setStyle({ left: rect.left + 8, width: rect.width - 16, top: Math.max(8, rect.top - 84) })
        return
      }
      const available = mode === 'left' ? innerWidth - rect.right - 20 : rect.left - 20
      const width = Math.max(320, Math.min(520, available))
      setStyle({ left: mode === 'left' ? rect.right + 10 : Math.max(10, rect.left - width - 10), width, top: rect.top })
    }

    update()
    window.addEventListener('resize', update)
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [hudRef, active])

  return { style, dock }
}
