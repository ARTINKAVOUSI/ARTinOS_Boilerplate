import { useCallback, useSyncExternalStore } from 'react'
import { defaultsOf, type ControlValue, type Values } from './feature'
import { features, findFeature } from './registry'

/**
 * Studio state: per-feature enabled flag, control values and effect order.
 * A plain external store read with useSyncExternalStore, persisted to
 * localStorage. Features themselves never read it — the app passes values in as
 * props — so the store is replaceable without touching a single feature.
 */

export interface FeatureState {
  enabled: boolean
  values: Values
  /** Effects only: pipeline position override. */
  order?: number
}

/** A control the command palette asked a panel to show. */
export interface RevealTarget {
  featureId: string
  control?: string
  /** Makes each request distinct, so asking twice reveals twice. */
  at: number
}

export interface StudioState {
  features: Record<string, FeatureState>
  /** Named snapshots of `features`. */
  presets: Record<string, Record<string, FeatureState>>
  /** `advanced` reveals the controls a manifest marks advanced, as v1's Advanced switch did. */
  ui: { visible: boolean; theme: string; advanced: boolean }
  reveal: RevealTarget | null
}

const STORAGE_KEY = 'artinos.v2.studio'
const VERSION = 1

function initialFeatures(): Record<string, FeatureState> {
  const result: Record<string, FeatureState> = {}
  for (const feature of features) {
    result[feature.id] = { enabled: feature.enabled ?? true, values: defaultsOf(feature.controls), order: feature.order }
  }
  return result
}

/** A `blob:` URL (a file dropped into the Library's Assets) dies with the page that made it. */
const deadAfterReload = (value: unknown) => typeof value === 'string' && value.startsWith('blob:')

/** Merge persisted state over defaults, dropping features and controls that no longer exist. */
function reconcile(saved: Record<string, FeatureState> | undefined): Record<string, FeatureState> {
  const base = initialFeatures()
  if (!saved) return base
  for (const [id, state] of Object.entries(base)) {
    const previous = saved[id]
    if (!previous) continue
    const values = { ...state.values }
    for (const key of Object.keys(values)) if (key in (previous.values ?? {}) && !deadAfterReload(previous.values[key])) values[key] = previous.values[key]
    base[id] = { enabled: previous.enabled ?? state.enabled, values, order: previous.order ?? state.order }
  }
  return base
}

function load(): StudioState {
  const fallback: StudioState = { features: initialFeatures(), presets: {}, ui: { visible: true, theme: 'frost-deep', advanced: false }, reveal: null }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (parsed?.version !== VERSION) return fallback
    return {
      features: reconcile(parsed.features),
      presets: parsed.presets ?? {},
      // Only the keys the studio still has; an older save may carry favorites or pins.
      ui: { visible: parsed.ui?.visible ?? fallback.ui.visible, theme: parsed.ui?.theme ?? fallback.ui.theme, advanced: parsed.ui?.advanced ?? fallback.ui.advanced },
      reveal: null,
    }
  } catch {
    return fallback
  }
}

let state = load()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
/** When the first unsaved change happened, so a steady stream of changes still gets saved. */
let dirtySince = 0

function save() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  dirtySince = 0
  try {
    // `reveal` is a one-off request to the panels, not something to restore.
    const { features, presets, ui } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, features, presets, ui }))
  } catch {
    /* storage unavailable — the session still works */
  }
}

// Saving is debounced; write the last change out if the page goes away first.
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => saveTimer !== undefined && save())

function commit(next: StudioState) {
  state = next
  listeners.forEach(listener => listener())
  // Debounced, but never put off for more than a second: a control a graph keeps
  // driving would otherwise postpone the save forever.
  const now = Date.now()
  dirtySince ||= now
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, now - dirtySince > 1000 ? 0 : 150)
}

/** Chain position of an effect: the studio's override, else its manifest, else the host default. */
export const effectOrder = (id: string, states = state.features) => states[id]?.order ?? findFeature(id)?.order ?? 500

let lastReveal = 0
/** How long a palette jump stays live: long enough for the panel to open and act on it. */
const REVEAL_MS = 2500

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getState = () => state

export const studio = {
  getState,
  subscribe,

  setEnabled(id: string, enabled: boolean) {
    const current = state.features[id]
    if (!current || current.enabled === enabled) return
    commit({ ...state, features: { ...state.features, [id]: { ...current, enabled } } })
  },

  setValue(id: string, key: string, value: ControlValue) {
    const current = state.features[id]
    if (!current || Object.is(current.values[key], value)) return
    commit({ ...state, features: { ...state.features, [id]: { ...current, values: { ...current.values, [key]: value } } } })
  },

  reset(id: string) {
    const feature = findFeature(id)
    if (!feature) return
    commit({
      ...state,
      features: { ...state.features, [id]: { ...state.features[id], values: defaultsOf(feature.controls), order: feature.order } },
    })
  },

  resetAll() {
    commit({ ...state, features: initialFeatures() })
  },

  /** Set an effect's pipeline position directly (lower runs first). */
  setOrder(id: string, order: number) {
    const current = state.features[id]
    if (!current || current.order === order) return
    commit({ ...state, features: { ...state.features, [id]: { ...current, order } } })
  },

  /** Move an effect one slot earlier or later among the active effects. */
  moveEffect(id: string, direction: -1 | 1) {
    const effects = features
      .filter(feature => feature.kind === 'effect' && state.features[feature.id]?.enabled)
      .map(feature => ({ id: feature.id, order: effectOrder(feature.id) }))
      .sort((a, b) => a.order - b.order)
    const index = effects.findIndex(effect => effect.id === id)
    const swap = effects[index + direction]
    if (index < 0 || !swap) return
    const self = effects[index]
    // Equal orders cannot swap meaningfully; nudge apart first.
    const [a, b] = self.order === swap.order ? [swap.order + direction, self.order] : [swap.order, self.order]
    commit({
      ...state,
      features: {
        ...state.features,
        [self.id]: { ...state.features[self.id], order: a },
        [swap.id]: { ...state.features[swap.id], order: b },
      },
    })
  },

  savePreset(name: string) {
    commit({ ...state, presets: { ...state.presets, [name]: structuredClone(state.features) } })
  },

  loadPreset(name: string) {
    const preset = state.presets[name]
    if (preset) commit({ ...state, features: reconcile(preset) })
  },

  deletePreset(name: string) {
    const { [name]: _removed, ...rest } = state.presets
    commit({ ...state, presets: rest })
  },

  exportJSON() {
    return JSON.stringify({ version: VERSION, features: state.features }, null, 2)
  },

  importJSON(text: string) {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed.features !== 'object') throw new Error('Not an ARTINOS preset file')
    commit({ ...state, features: reconcile(parsed.features) })
  },

  /**
   * Point the panels at one control: the owning card opens and the row is
   * highlighted. A one-off request, cleared after a moment, so a panel opened
   * later does not replay it and the highlight does not stay forever.
   */
  reveal(featureId: string, control?: string) {
    const at = (lastReveal = Math.max(Date.now(), lastReveal + 1))
    commit({ ...state, reveal: { featureId, control, at } })
    setTimeout(() => state.reveal?.at === at && commit({ ...state, reveal: null }), REVEAL_MS)
  },

  setUI(patch: Partial<StudioState['ui']>) {
    const ui = { ...state.ui, ...patch }
    if (ui.visible === state.ui.visible && ui.theme === state.ui.theme && ui.advanced === state.ui.advanced) return
    commit({ ...state, ui })
  },
}

export function useStudio<T>(select: (state: StudioState) => T): T {
  const selector = useCallback(() => select(state), [select])
  return useSyncExternalStore(subscribe, selector, selector)
}

export function useFeatureState(id: string): FeatureState | undefined {
  return useSyncExternalStore(subscribe, () => state.features[id], () => state.features[id])
}
