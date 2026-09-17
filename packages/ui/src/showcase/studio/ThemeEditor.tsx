import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Button, Collapsible, ColorField, Note, Pane, Segmented, Select, Slider, TextField, Toolbar } from '../../primitives'

/**
 * Theme editor — the material world, the scene, and every token under them.
 *
 * Five kinds cover what the tokens actually are: a colour, a length, a bare
 * ratio, raw CSS, and white-at-an-alpha. The last carries the most weight: the
 * ink ramp, edges and the active material are all white at an alpha, which
 * `<input type="color">` cannot express because it has no alpha channel.
 */

export type TokenKind = 'color' | 'length' | 'ratio' | 'white' | 'raw'

export interface TokenControl {
  token: string
  label: string
  kind: TokenKind
  min?: number
  max?: number
  step?: number
  unit?: string
}

export interface TokenGroup {
  id: string
  label: string
  open?: boolean
  tokens: TokenControl[]
}

/** The six material worlds of the reference, in its order. */
export const WORLDS = [
  { id: 'clear', label: 'Clear', name: '01 · Clear Glass — highest transmission' },
  { id: 'frost', label: 'Frost', name: '02 · Frost Glass — canonical' },
  { id: 'satin', label: 'Satin', name: '03 · Satin Glass — silk relief' },
  { id: 'graphite', label: 'Graphite', name: '04 · Graphite Frost — smoked studio' },
  { id: 'opal', label: 'Opal', name: '05 · Opal Stone — mineral body' },
  { id: 'monolith', label: 'Monolith', name: '06 · Monolith — architectural mass' },
] as const

/** The scenes the glass can transmit. */
export const SCENES = [
  { id: 'atelier', label: 'Atelier' },
  { id: 'garden', label: 'Garden' },
  { id: 'studio', label: 'Studio' },
] as const

export const DENSITY_OPTIONS = ['default', 'compact', 'touch'] as const

export type WorldId = (typeof WORLDS)[number]['id']
export type SceneId = (typeof SCENES)[number]['id']
export type DensityOption = (typeof DENSITY_OPTIONS)[number]

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'material',
    label: 'Material',
    open: true,
    tokens: [
      { token: '--ui-blur', label: 'Frost', kind: 'length', min: 0, max: 64, step: 1, unit: 'px' },
      { token: '--ui-sat', label: 'Transmission', kind: 'ratio', min: 0, max: 2, step: 0.02 },
      { token: '--ui-grain', label: 'Grain', kind: 'ratio', min: 0, max: 0.15, step: 0.005 },
      { token: '--ui-edge', label: 'Edge', kind: 'white', min: 0, max: 60, step: 1, unit: '%' },
      { token: '--ui-edge-lit', label: 'Edge light', kind: 'white', min: 0, max: 100, step: 1, unit: '%' },
      { token: '--ui-glass', label: 'Glass', kind: 'raw' },
      { token: '--ui-glass-top', label: 'Glass top', kind: 'raw' },
      { token: '--ui-depth', label: 'Depth', kind: 'raw' },
    ],
  },
  {
    id: 'body',
    label: 'Body and active',
    tokens: [
      { token: '--ui-active-lit', label: 'Active lit', kind: 'white', min: 0, max: 100, step: 1, unit: '%' },
      { token: '--ui-active-a', label: 'Active', kind: 'white', min: 0, max: 100, step: 1, unit: '%' },
      { token: '--ui-active-b', label: 'Active low', kind: 'white', min: 0, max: 100, step: 1, unit: '%' },
      { token: '--ui-body', label: 'Body', kind: 'raw' },
      { token: '--ui-body-in', label: 'Body light', kind: 'raw' },
      { token: '--ui-well', label: 'Well', kind: 'raw' },
      { token: '--ui-ink-active', label: 'Active ink', kind: 'raw' },
      { token: '--ui-seam', label: 'Seam', kind: 'raw' },
    ],
  },
  {
    id: 'geometry',
    label: 'Geometry',
    tokens: [
      { token: '--ui-r-panel', label: 'Panel radius', kind: 'length', min: 0, max: 24, step: 1, unit: 'px' },
      { token: '--ui-r-comp', label: 'Capsule radius', kind: 'length', min: 0, max: 16, step: 1, unit: 'px' },
      { token: '--ui-r-active', label: 'Active radius', kind: 'length', min: 0, max: 12, step: 1, unit: 'px' },
      { token: '--ui-r-micro', label: 'Micro radius', kind: 'length', min: 0, max: 8, step: 1, unit: 'px' },
      { token: '--ui-h-comp', label: 'Capsule', kind: 'length', min: 17, max: 36, step: 1, unit: 'px' },
      { token: '--ui-h-comp-sm', label: 'Compact', kind: 'length', min: 14, max: 30, step: 1, unit: 'px' },
      { token: '--ui-gap-row', label: 'Row gap', kind: 'length', min: 0, max: 10, step: 1, unit: 'px' },
      { token: '--ui-pad-panel', label: 'Panel padding', kind: 'length', min: 4, max: 20, step: 1, unit: 'px' },
      { token: '--ui-label-w', label: 'Label column', kind: 'length', min: 40, max: 120, step: 1, unit: 'px' },
    ],
  },
  {
    id: 'ink',
    label: 'Ink',
    tokens: [
      { token: '--ui-ink', label: 'Ink', kind: 'white', min: 50, max: 100, step: 1, unit: '%' },
      { token: '--ui-ink-2', label: 'Ink 2', kind: 'white', min: 30, max: 100, step: 1, unit: '%' },
      { token: '--ui-ink-3', label: 'Ink 3', kind: 'white', min: 15, max: 80, step: 1, unit: '%' },
      { token: '--ui-ink-4', label: 'Ink 4', kind: 'white', min: 5, max: 60, step: 1, unit: '%' },
    ],
  },
  {
    id: 'signal',
    label: 'Signal',
    tokens: [
      { token: '--ui-sig', label: 'Live', kind: 'color' },
      { token: '--ui-sig-warm', label: 'Modified', kind: 'color' },
      { token: '--ui-sig-rose', label: 'Warning', kind: 'color' },
      { token: '--ui-sig-soft', label: 'Glow', kind: 'raw' },
      { token: '--ui-sig-line', label: 'Line', kind: 'raw' },
    ],
  },
  {
    id: 'motion',
    label: 'Motion',
    tokens: [
      { token: '--ui-mass', label: 'Mass', kind: 'ratio', min: 0.2, max: 3, step: 0.05 },
      { token: '--ui-spring', label: 'Spring', kind: 'ratio', min: 40, max: 400, step: 5 },
      { token: '--ui-damp', label: 'Damping', kind: 'ratio', min: 5, max: 50, step: 1 },
      { token: '--ui-t-fast', label: 'Fast', kind: 'length', min: 0, max: 400, step: 10, unit: 'ms' },
      { token: '--ui-t-mid', label: 'Mid', kind: 'length', min: 0, max: 600, step: 10, unit: 'ms' },
      { token: '--ui-t-slow', label: 'Slow', kind: 'length', min: 0, max: 1000, step: 10, unit: 'ms' },
    ],
  },
]

/** Flat view of every control the editor exposes. */
export const TOKEN_CONTROLS: TokenControl[] = TOKEN_GROUPS.flatMap(group => group.tokens)

export interface ThemeState {
  world: WorldId
  scene: SceneId
  density: DensityOption
  overrides: Record<string, string>
}

/** The overrides as a stylesheet: on `:root` for Frost, on the world's selector otherwise. */
export function overridesToCSS({ world, density, overrides }: ThemeState): string {
  const entries = Object.entries(overrides)
  const scope = world === 'frost' ? ':root' : `[data-world='${world}']`
  const context = density === 'default' ? '' : `\n/* set data-context="${density}" on the workspace root */`
  if (!entries.length) return `${scope} {\n  /* no overrides — the world's own tokens are in use */\n}${context}`
  return `${scope} {\n${entries.map(([token, value]) => `  ${token}: ${value};`).join('\n')}\n}${context}`
}

function numberOf(value: string | undefined, fallback: number): number {
  const parsed = parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

/** `rgba(255, 255, 255, 0.4)` or `#ffffff66` → 40. A white-at-alpha token as a percentage. */
function alphaOf(value: string | undefined, fallback: number): number {
  const text = (value ?? '').trim()
  const rgba = text.match(/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (rgba) return Math.round((rgba[1] === undefined ? 1 : parseFloat(rgba[1])) * 100)
  if (/^#[0-9a-f]{8}$/i.test(text)) return Math.round((parseInt(text.slice(7, 9), 16) / 255) * 100)
  if (/^#[0-9a-f]{6}$/i.test(text)) return 100
  return fallback
}

function whiteAt(percent: number): string {
  return `rgba(255, 255, 255, ${(percent / 100).toFixed(2)})`
}

/** Reads a token off the themed surface, so a control starts where the world put it. */
function readToken(root: HTMLElement | null, token: string): string {
  return root ? getComputedStyle(root).getPropertyValue(token).trim() : ''
}

export function ThemeEditor({
  state,
  scope,
  onChange,
}: {
  state: ThemeState
  /** The themed element the controls read their starting values from. */
  scope: HTMLElement | null
  /** Takes an updater so two changes in one tick cannot overwrite each other. */
  onChange: Dispatch<SetStateAction<ThemeState>>
}) {
  const [copied, setCopied] = useState(false)
  // A world or density is applied to the DOM after this render commits, so the
  // controls read the previous world's values once. One more pass reads the new ones.
  const [, reread] = useState(0)
  useEffect(() => reread(pass => pass + 1), [state.world, state.density])

  const set = (patch: Partial<ThemeState>) => onChange(previous => ({ ...previous, ...patch }))
  const setToken = (token: string, value: string) =>
    onChange(previous => ({ ...previous, overrides: { ...previous.overrides, [token]: value } }))
  const clearToken = (token: string) =>
    onChange(previous => {
      const next = { ...previous.overrides }
      delete next[token]
      return { ...previous, overrides: next }
    })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(overridesToCSS(state))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard is a convenience; the CSS is on screen either way */
    }
  }

  function control(entry: TokenControl) {
    const value = state.overrides[entry.token] ?? readToken(scope, entry.token)
    // The marker lights on a token you have moved; clicking it puts that one back,
    // so one wrong nudge never costs the rest of the session's tuning.
    const marker = entry.token in state.overrides ? { pinned: true, onPinnedChange: () => clearToken(entry.token) } : {}

    if (entry.kind === 'color') {
      // A colour input has no alpha; keep the token's own alpha on the way out.
      const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value) ? value : ''
      const alpha = hex.length === 9 ? hex.slice(7, 9) : ''
      return (
        <ColorField
          key={entry.token}
          label={entry.label}
          value={hex ? hex.slice(0, 7) : '#6fe3c0'}
          onChange={next => setToken(entry.token, `${next}${alpha}`)}
        />
      )
    }
    if (entry.kind === 'raw') {
      return (
        <TextField
          key={entry.token}
          label={entry.label}
          value={value}
          onChange={next => (next.trim() ? setToken(entry.token, next) : clearToken(entry.token))}
        />
      )
    }
    if (entry.kind === 'white') {
      return (
        <Slider
          key={entry.token}
          label={entry.label}
          value={alphaOf(value, entry.min ?? 0)}
          min={entry.min ?? 0}
          max={entry.max ?? 100}
          step={entry.step ?? 1}
          unit={entry.unit}
          {...marker}
          onChange={next => setToken(entry.token, whiteAt(next))}
        />
      )
    }
    const ratio = entry.kind === 'ratio'
    return (
      <Slider
        key={entry.token}
        label={entry.label}
        value={numberOf(value, entry.min ?? 0)}
        min={entry.min ?? 0}
        max={entry.max ?? (ratio ? 1 : 100)}
        step={entry.step ?? (ratio ? 0.01 : 1)}
        unit={entry.unit}
        {...marker}
        onChange={next => setToken(entry.token, ratio ? String(next) : `${next}${entry.unit ?? ''}`)}
      />
    )
  }

  const count = Object.keys(state.overrides).length

  return (
    <Pane
      className="ui-studio-side"
      title="Theme"
      meta="Material world · live tokens"
      status={count ? 'modified' : 'live'}
      footer={
        <>
          <span>
            {count} {count === 1 ? 'override' : 'overrides'}
          </span>
          <span>Scoped to this page</span>
        </>
      }
    >
      <Select label="World" value={state.world} options={WORLDS.map(world => ({ label: world.label, value: world.id }))} onChange={(world: WorldId) => set({ world })} />
      <Select label="Scene" value={state.scene} options={SCENES.map(scene => ({ label: scene.label, value: scene.id }))} onChange={(scene: SceneId) => set({ scene })} />
      <Segmented label="Density" value={state.density} options={[...DENSITY_OPTIONS]} onChange={(density: DensityOption) => set({ density })} />

      <Toolbar fill>
        <Button onClick={copy}>{copied ? 'Copied' : 'Copy CSS'}</Button>
        <Button disabled={!count} onClick={() => set({ overrides: {} })}>
          Reset all
        </Button>
      </Toolbar>

      {TOKEN_GROUPS.map(group => (
        <Collapsible key={group.id} title={group.label} defaultOpen={group.open ?? false}>
          {group.tokens.map(control)}
        </Collapsible>
      ))}

      <Note>
        A world reassigns the material; it never touches a component rule. A lit marker is a token you have
        moved — click it to put that one back. Copy CSS hands you only what you changed.
      </Note>
    </Pane>
  )
}
