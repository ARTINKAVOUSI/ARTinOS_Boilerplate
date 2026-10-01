import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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

const hasRender = features.some(feature => feature.id === 'scene.render')
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
      const { innerWidth: vw, innerHeight: vh } = window
      // A side dock: the bar runs along the bottom of the free side beside it.
      if (rect.height > rect.width * 1.2) {
        const onRight = rect.left + rect.width / 2 > vw / 2
        const left = onRight ? 8 : rect.right + 8
        const width = Math.max(320, (onRight ? rect.left : vw - rect.right) - 16)
        setStyle({ left, top: vh - height - 8, width })
        return
      }
      // A band: above it when there is room, else below it; never over its strip.
      const width = Math.min(vw - 16, Math.max(rect.width - 16, 560))
      const left = Math.min(vw - width - 8, Math.max(8, rect.left + 8))
      const above = rect.top - height - 8
      const top = above >= 8 ? above : Math.min(vh - height - 8, rect.bottom + 8)
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

/** One instrument in the bar: a caps name (and a quiet reading beside it) over one row of content. */
function Group({ name, meta, className, children }: { name: string; meta?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={className ? `hud-bar__group ${className}` : 'hud-bar__group'} aria-label={name}>
      <header>
        <span>{name}</span>
        {meta}
      </header>
      <div className="hud-bar__row">{children}</div>
    </section>
  )
}

/**
 * The runtime readout in the dock strip, and the studio bar it opens: one slim
 * instrument strip along the dock — performance, renderer load, the quality
 * tier, the theme and the studio's own switches. Pass timings and memory live
 * in the Console panel.
 */
export function RuntimeHUD() {
  const stats = useRuntime()
  const render = useFeatureState('scene.render')
  const ui = useStudio(selectUI)
  const [open, setOpen] = useState(false)
  const hud = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const anchor = useAnchor(open, hud, bar)

  const fps = Math.round(stats.fps)
  const health = healthOf(fps)
  const ratio = Number(render?.values.maxPixelRatio ?? 1)
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
    // Escape inside a dialog or list opened from the bar closes that, not the bar.
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !event.defaultPrevented && !(event.target as Element | null)?.closest?.('.ar-list, .ar-menu, .ar-dialog') && setOpen(false)
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
  // Only while open: it reads layout, and the readout re-renders 4×/s.
  useLayoutEffect(() => {
    if (open) edges()
  })

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
      <Group name="Performance" className="hud-bar__perf" meta={<em className="hud-bar__health">{HEALTH_WORD[health]}</em>}>
        <span className="hud-bar__fps" title={`${fps} frames per second`}>
          <strong>{fps}</strong>
          <small>fps</small>
        </span>
        <span className="hud-bar__frame" title={`${stats.frameMs.toFixed(2)} ms per frame; the ${TARGET_FPS} fps budget is ${BUDGET_MS.toFixed(1)} ms`}>
          <b>
            {stats.frameMs.toFixed(1)}
            <small>ms</small>
          </b>
          <span data-over={budget > 1 || undefined}>{Math.round(budget * 100)}%</span>
        </span>
        <Sparkline className="hud-bar__spark" values={stats.fpsHistory} min={0} max={Math.max(TARGET_FPS, ...stats.fpsHistory)} threshold={TARGET_FPS} width={160} height={26} tone={health === 'good' ? 'live' : 'warm'} label="Frame rate, last 15 seconds" />
      </Group>

      <Group name="Renderer" className="hud-bar__renderer" meta={<span title={`Pixel ratio ${stats.renderer.pixelRatio.toFixed(2)}×`}>{backend} · {stats.renderer.width}×{stats.renderer.height}</span>}>
        {[
          ['calls', compactNumber(stats.renderer.calls)],
          ['tris', compactNumber(stats.renderer.triangles)],
          ['geo', String(stats.renderer.geometries)],
          ['tex', String(stats.renderer.textures)],
        ].map(([label, value]) => (
          <span key={label} className="hud-bar__stat">
            <b>{value}</b>
            <small>{label}</small>
          </span>
        ))}
      </Group>

      {hasRender && (
        <Group name="Quality" className="hud-bar__quality" meta={<span title="Pixel-ratio ceiling">≤ {ratio.toFixed(2)}×</span>}>
          <Segmented<Tier>
            label="Quality tier"
            value={tier}
            onChange={value => studio.setValue('scene.render', 'maxPixelRatio', TIERS.find(entry => entry.value === value)!.ratio)}
            options={TIERS.map(({ value, label }) => ({ value, label }))}
          />
        </Group>
      )}

      <Group name="Theme" meta={<span>{THEME_META[ui.theme as keyof typeof THEME_META]?.label.replace(/ Frost$/, '') ?? ui.theme}</span>}>
        <span role="radiogroup" aria-label="Theme" className="hud-bar__swatches">
          {GLASS_THEMES.map(theme => {
            const meta = THEME_META[theme]
            return (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={ui.theme === theme}
                aria-label={meta.label}
                className="hud-bar__swatch"
                title={`${meta.label}: ${meta.description}`}
                style={{ '--_a': meta.swatch[0], '--_b': meta.swatch[1], '--_c': meta.swatch[2] } as CSSProperties}
                onClick={() => studio.setUI({ theme })}
              />
            )
          })}
        </span>
      </Group>

      <Group name="Studio" className="hud-bar__studio">
        <label className="hud-bar__text" title="Show the controls a feature marks advanced">
          <span className="hud-bar__label-text">Advanced</span>
          <Switch variant="compact" label="Show advanced controls" value={ui.advanced} onChange={advanced => studio.setUI({ advanced })} />
        </label>
        <button
          type="button"
          className="hud-bar__text hud-bar__hide"
          onClick={() => {
            setOpen(false)
            studio.setUI({ visible: false })
          }}
          title="Hide the interface; press H to bring it back"
        >
          <span className="hud-bar__label-text">Hide</span> <Kbd keys={['H']} />
        </button>
        <span className="hud-bar__tools">
          <PresetMenu />
          <IconButton label="Reset the dock layout" icon={Icons.layout} filled onClick={resetDockLayout} />
          <IconButton label="Reset every feature to its defaults" icon={Icons.reset} filled className="hud-bar__danger" onClick={() => studio.resetAll()} />
        </span>
      </Group>
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
