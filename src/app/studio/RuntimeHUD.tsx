import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { features } from '../registry'
import { compactNumber, useRuntime } from '../runtime'
import { studio, useFeatureState, useStudio, type StudioState } from '../store'
import { Segmented } from '../../ui/Segmented/Segmented'
import { Sparkline } from '../../ui/Sparkline/Sparkline'
import { Switch } from '../../ui/Switch/Switch'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Kbd } from '../../ui/Kbd/Kbd'
import { GLASS_THEMES, THEME_META } from '../../ui/system/utils'
import { resetDockLayout } from './layout'
import { PresetMenu } from './PresetMenu'
import { Icons } from './icons'
import './RuntimeHUD.css'

/** Resolution tiers: the Render feature's pixel-ratio ceiling, as four steps. */
const TIERS = [
  { value: 'low', label: 'Low', ratio: 0.6 },
  { value: 'balanced', label: 'Mid', ratio: 1 },
  { value: 'high', label: 'High', ratio: 1.5 },
  { value: 'ultra', label: 'Ultra', ratio: 2 },
] as const
type Tier = (typeof TIERS)[number]['value']
const TARGET_FPS = 60
const BUDGET_MS = 1000 / TARGET_FPS

/** Overlays that exist to diagnose (a feature in the Diagnostics group): toggled from the bar. */
const diagnostics = features.filter(feature => feature.group === 'Diagnostics')
const hasRender = features.some(feature => feature.id === 'scene.render')
const selectFeatures = (state: StudioState) => state.features
const selectUI = (state: StudioState) => state.ui

const healthOf = (fps: number) => (fps >= TARGET_FPS * 0.9 ? 'good' : fps >= TARGET_FPS * 0.65 ? 'warn' : 'bad')
const HEALTH_WORD = { good: 'stable', warn: 'strained', bad: 'limited' } as const

const polyline = (values: number[], width: number, baseline: number, span: number, ceiling: number) => {
  if (values.length < 2) return ''
  return values.map((value, index) => `${((index / (values.length - 1)) * width).toFixed(1)},${(baseline - (Math.min(ceiling, value) / ceiling) * span).toFixed(1)}`).join(' ')
}

/** Where the bar sits: along the dock the readout lives in, above it (or below, when the dock is at the top). */
function useAnchor(open: boolean, hud: React.RefObject<HTMLDivElement | null>, bar: React.RefObject<HTMLDivElement | null>) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })
  useLayoutEffect(() => {
    if (!open) return
    const dock = hud.current?.closest<HTMLElement>('.mb-group')
    if (!dock) return
    const place = () => {
      const rect = dock.getBoundingClientRect()
      const height = bar.current?.offsetHeight ?? 0
      // above the dock when there is room, else below it; never over its strip
      const width = Math.min(window.innerWidth - 16, Math.max(rect.width - 16, 560))
      const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + 8))
      const above = rect.top - height - 8
      const top = above >= 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + 8)
      setStyle({ left, top, width })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(dock)
    if (bar.current) observer.observe(bar.current)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [open, hud, bar])
  return style
}

/**
 * The runtime readout in the dock strip, and the studio bar it opens: one slim
 * sheet along the dock. The first row is telemetry (frame rate and frame time
 * with their history, renderer load, the diagnostic overlays, the quality
 * tier); the second is the studio itself (theme, interface, layout).
 */
export function RuntimeHUD() {
  const stats = useRuntime()
  const render = useFeatureState('scene.render')
  const states = useStudio(selectFeatures)
  const ui = useStudio(selectUI)
  const [open, setOpen] = useState(false)
  const hud = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const anchor = useAnchor(open, hud, bar)

  const fps = Math.round(stats.fps)
  const health = healthOf(fps)
  const ratio = Number(render?.values.maxPixelRatio ?? 2)
  const tier: Tier = [...TIERS].reverse().find(entry => ratio >= entry.ratio)?.value ?? 'low'
  const budget = stats.frameMs / BUDGET_MS
  const backend = stats.backend === 'webgpu' ? 'WebGPU' : stats.backend === 'webgl2' ? 'WebGL2' : 'GPU'

  // An outside press or Escape closes the bar; the readout toggles it.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!hud.current?.contains(target) && !bar.current?.contains(target) && !(target as Element).closest?.('.ar-list, .ar-menu, .ar-dialog')) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  // A narrow window scrolls the row: the wheel moves it sideways, and a fade
  // marks whichever edge still has more cells beyond it.
  const edges = () => {
    const el = bar.current
    if (!el) return
    el.dataset.more = [el.scrollLeft > 2 && 'start', el.scrollLeft + el.clientWidth < el.scrollWidth - 2 && 'end'].filter(Boolean).join(' ')
  }
  useLayoutEffect(edges)

  const sheet = (
    <div
      ref={bar}
      className="hud-bar"
      data-health={health}
      role="dialog"
      aria-label="Studio bar"
      style={anchor}
      onScroll={edges}
      onWheel={event => {
        const el = event.currentTarget
        if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
        el.scrollLeft += event.deltaY
      }}
    >
      <section className="hud-bar__cell hud-bar__status">
        <header title="Performance">
          {Icons.activity}
          <em>{HEALTH_WORD[health]}</em>
        </header>
        <p title={`Pixel ratio ${stats.renderer.pixelRatio.toFixed(2)}×`}>
          <span>{backend}</span>
          <span>
            {stats.renderer.width}×{stats.renderer.height}
          </span>
        </p>
      </section>

      <section className="hud-bar__cell hud-bar__graph">
        <div className="hud-bar__figure">
          <strong>{fps}</strong>
          <small>fps</small>
        </div>
        <Sparkline className="hud-bar__spark" values={stats.fpsHistory} min={0} max={Math.max(TARGET_FPS, ...stats.fpsHistory)} threshold={TARGET_FPS} width={200} height={36} label="Frame rate, last 15 seconds" />
      </section>

      <section className="hud-bar__cell hud-bar__graph">
        <div className="hud-bar__figure">
          <strong>{stats.frameMs.toFixed(1)}</strong>
          <small>ms</small>
          <span data-over={budget > 1 || undefined}>{Math.round(budget * 100)}% budget</span>
        </div>
        <Sparkline className="hud-bar__spark" values={stats.history} min={0} max={50} threshold={BUDGET_MS} width={200} height={36} tone={budget > 1.5 ? 'warm' : 'live'} label={`Frame time, last ${stats.history.length} frames`} />
      </section>

      <section className="hud-bar__cell hud-bar__load">
        {[
          ['Calls', compactNumber(stats.renderer.calls)],
          ['Tris', compactNumber(stats.renderer.triangles)],
          ['Geos', String(stats.renderer.geometries)],
          ['Tex', String(stats.renderer.textures)],
        ].map(([label, value]) => (
          <span key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </span>
        ))}
      </section>

      {diagnostics.length > 0 && (
        <section className="hud-bar__cell hud-bar__overlays">
          <small className="hud-bar__label">Overlays</small>
          <div>
            {diagnostics.map(feature => {
              const on = Boolean(states[feature.id]?.enabled)
              return (
                <button
                  key={feature.id}
                  type="button"
                  className="hud-bar__chip"
                  aria-pressed={on}
                  title={`${feature.description ?? feature.label}\nSettings: Inspector panel`}
                  onClick={() => studio.setEnabled(feature.id, !on)}
                >
                  <i aria-hidden />
                  {feature.label.replace(/ (HUD|Monitor|Inspector)$/, '')}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {hasRender && (
        <section className="hud-bar__cell hud-bar__quality">
          <header>
            <small className="hud-bar__label">Quality</small>
            <small>pixel ratio ≤ {ratio.toFixed(2)}</small>
          </header>
          <Segmented<Tier>
            label="Quality tier"
            value={tier}
            onChange={value => studio.setValue('scene.render', 'maxPixelRatio', TIERS.find(entry => entry.value === value)!.ratio)}
            options={TIERS.map(({ value, label }) => ({ value, label }))}
          />
        </section>
      )}

      <section className="hud-bar__cell hud-bar__themes">
        <small className="hud-bar__label">Theme</small>
        <div role="radiogroup" aria-label="Theme">
          {GLASS_THEMES.map(theme => {
            const meta = THEME_META[theme]
            return (
              <button key={theme} type="button" role="radio" aria-checked={ui.theme === theme} aria-label={meta.label} className="hud-bar__theme" title={`${meta.label}: ${meta.description}`} onClick={() => studio.setUI({ theme })}>
                <span aria-hidden>
                  {meta.swatch.map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </span>
                {meta.label.replace(/ Frost$/, '')}
              </button>
            )
          })}
        </div>
      </section>

      <section className="hud-bar__cell hud-bar__view">
        <small className="hud-bar__label">View</small>
        <div>
          <label className="hud-bar__switch" title="Show the controls a feature marks advanced">
            Advanced
            <Switch variant="compact" label="Show advanced controls" value={ui.advanced} onChange={advanced => studio.setUI({ advanced })} />
          </label>
          <button
            type="button"
            className="hud-bar__key"
            onClick={() => {
              setOpen(false)
              studio.setUI({ visible: false })
            }}
            title="Hide the interface; press H to bring it back"
          >
            Hide <Kbd keys={['H']} />
          </button>
          <span className="hud-bar__resets">
            <PresetMenu />
          <IconButton label="Reset the dock layout" icon={Icons.layout} filled onClick={resetDockLayout} />
          <IconButton label="Reset every feature to its defaults" icon={Icons.reset} filled className="hud-bar__danger" onClick={() => studio.resetAll()} />
          </span>
        </div>
      </section>
    </div>
  )

  return (
    <div ref={hud} className={`artinos-hud is-embedded ${open ? 'is-open' : ''} heat-${health}`} aria-label="Runtime telemetry">
      <button type="button" className="artinos-hud-summary" onClick={() => setOpen(value => !value)} aria-expanded={open} title="Performance, telemetry and appearance">
        <span className="artinos-hud-backend">
          <i className={fps > 0 ? 'is-live' : ''} />
          <b>{stats.backend ?? 'GPU'}</b>
        </span>
        <span className="artinos-hud-readout hud-fps" title={`${fps} frames per second`}>
          <strong>{fps}</strong>
          <small>fps</small>
        </span>
        <svg className="artinos-hud-micrograph" viewBox="0 0 54 16" aria-hidden="true">
          <polyline className="is-cpu" points={polyline(stats.history.slice(-48), 54, 14, 12, 50)} />
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
      {open && createPortal(sheet, document.body)}
    </div>
  )
}
