import { tokenGraph } from './design/token-graph'

/**
 * Programmatic access to the design roles declared in `tokens.css`.
 *
 * `TOKEN_GRAPH` is canonical; CSS custom properties are its low-cost resolved
 * output for stylesheets, SVG and inline renderer adapters.
 *
 * Only ROLES are exposed. Primitives (`--ink-*`, `--chalk-*`, `--teal-*`) are
 * deliberately absent: naming one from code pins that call site to a single
 * theme, which is the same bug as naming one from a component rule.
 */

export const TOKENS = {
  color: {
    /** Behind everything, including the canvas. */
    background: '--bg-app',
    /** Viewport ground and page sections. */
    stage: '--bg-stage',
    /** Panels, cards, dock body. */
    surface: '--bg-surface',
    /** Anything sitting on a surface. */
    raised: '--bg-raised',
    hover: '--bg-hover',
    active: '--bg-active',
    /** Inputs and tracks — recessed, not raised. */
    well: '--bg-well',
    /** Menus, popovers, dialogs. */
    float: '--bg-float',
    scrim: '--bg-scrim',

    text: '--text-hi',
    textSecondary: '--text-mid',
    textMuted: '--text-low',
    /** Units, counts, timestamps only — does not hold 4.5:1. */
    textFaint: '--text-faint',
    /** Disabled only. */
    textGhost: '--text-ghost',

    line: '--line-subtle',
    lineStrong: '--line-strong',
    lineEdge: '--line',

    /** Scrub fill and slider track. */
    track: '--fill-track',
    trackHover: '--fill-track-hover',
    /** The exact-value hairline. */
    tick: '--tick',
  },
  /** Meaning, never decoration. One hue per state. */
  signal: {
    /** Running, armed, enabled, primary. */
    live: '--sig-live',
    liveHi: '--sig-live-hi',
    liveWash: '--sig-live-wash',
    liveLine: '--sig-live-line',
    /** Degraded but proceeding. */
    warn: '--sig-warn',
    warnWash: '--sig-warn-wash',
    /** Stopped, invalid, destructive. */
    fault: '--sig-fault',
    faultWash: '--sig-fault-wash',
    /** Externally driven — MIDI, OSC, expression. */
    bind: '--sig-bind',
    bindWash: '--sig-bind-wash',
    neutral: '--sig-neutral',
  },
  radius: {
    control: '--radius-control',
    card: '--radius-card',
    panel: '--radius-panel',
    shell: '--radius-shell',
  },
  /** Three control heights cover the whole surface. A one-off height is a smell. */
  size: {
    controlSmall: '--control-h-sm',
    control: '--control-h',
    controlLarge: '--control-h-lg',
    rowGap: '--row-gap',
    panelHeader: '--panel-header-h',
    commandBar: '--command-bar-h',
    tabStrip: '--tab-strip-h',
    safeArea: '--safe-area',
  },
  /** 2px base, 8 steps. */
  space: {
    1: '--space-1',
    2: '--space-2',
    3: '--space-3',
    4: '--space-4',
    5: '--space-5',
    6: '--space-6',
    7: '--space-7',
    8: '--space-8',
  },
  /** Named by what moves. Reduced motion zeroes every duration. */
  motion: {
    value: '--dur-value',
    state: '--dur-state',
    surface: '--dur-surface',
    layout: '--dur-layout',
    easeStandard: '--ease-std',
    easeEnter: '--ease-enter',
  },
  /** One meaning each: recessed is editable, frost is floating chrome. */
  elevation: {
    well: '--e0-well',
    surface: '--e1-surface',
    dock: '--e2-dock',
    float: '--e3-float',
    focus: '--focus-ring',
  },
  material: {
    frostTint: '--frost-tint',
    frostSheen: '--frost-sheen',
    blurFrost: '--blur-frost',
    blurFloat: '--blur-float',
  },
  type: {
    display: '--type-display',
    title: '--type-title',
    hero: '--type-hero',
    panel: '--type-panel',
    section: '--type-section',
    body: '--type-body',
    label: '--type-label',
    value: '--type-value',
    readout: '--type-readout',
    fontUi: '--font-ui',
    fontNumeric: '--font-num',
    trackCaps: '--track-caps',
    trackPanel: '--track-panel',
  },
} as const

/** Canonical primitive → semantic → component → state → context graph. */
export const TOKEN_GRAPH = tokenGraph
export const tokenManifest = () => TOKEN_GRAPH.manifest()
export const emitTokenCSS = (rootSelector?: string) => TOKEN_GRAPH.emitCSS(rootSelector)

export const THEMES = {
  dark: { id: 'dark', label: 'Dark', material: 'frosted.standard', colorScheme: 'dark' },
  light: { id: 'light', label: 'Light', material: 'frosted.standard', colorScheme: 'light' },
  'high-contrast': { id: 'high-contrast', label: 'High Contrast', material: 'overlay', colorScheme: 'dark' },
  glass: { id: 'glass', label: 'Glass', material: 'frosted.dense', colorScheme: 'dark' },
  studio: { id: 'studio', label: 'Studio', material: 'frosted.standard', colorScheme: 'dark' },
  minimal: { id: 'minimal', label: 'Minimal', material: 'clear', colorScheme: 'dark' },
} as const

export type ThemeId = keyof typeof THEMES
export type UIContextId = 'compact' | 'touch' | 'canvas-overlay' | 'node' | 'inspector' | 'toolbar'

export function applyTheme(theme: ThemeId, element: HTMLElement = document.documentElement): void {
  element.dataset.theme = theme
  element.style.colorScheme = THEMES[theme].colorScheme
}

export function setUIContexts(contexts: UIContextId[], element: HTMLElement = document.documentElement): void {
  element.dataset.context = [...new Set(contexts)].join(' ')
}

export type TokenGroup = keyof typeof TOKENS
export type TokenName<G extends TokenGroup> = keyof (typeof TOKENS)[G]

/** CSS variable reference, for use in styles: `background: token('color', 'surface')`. */
export function token<G extends TokenGroup>(group: G, name: TokenName<G>): string {
  return `var(${TOKENS[group][name]})`
}

/**
 * Resolved token value, for APIs that cannot take a CSS variable — canvas fill styles,
 * three.js colors, chart libraries. Reads from `element` so a scoped theme override wins.
 *
 * Pass the themed element (the workspace root carries `data-theme`), not the document,
 * when the value must follow the active theme.
 */
export function resolveToken<G extends TokenGroup>(
  group: G,
  name: TokenName<G>,
  element: Element = document.documentElement,
): string {
  return getComputedStyle(element).getPropertyValue(String(TOKENS[group][name])).trim()
}

/** Overrides tokens on an element. Pass token names, not raw CSS variable strings. */
export function applyTokens(
  overrides: Partial<Record<string, string>>,
  element: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of Object.entries(overrides)) {
    if (value) element.style.setProperty(name.startsWith('--') ? name : `--${name}`, value)
  }
}
