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

export interface StudioState {
  features: Record<string, FeatureState>
  /** Named snapshots of `features`. */
  presets: Record<string, Record<string, FeatureState>>
  ui: { visible: boolean; world: string; favorites: string[]; pins: string[] }
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

/** Merge persisted state over defaults, dropping features and controls that no longer exist. */
function reconcile(saved: Record<string, FeatureState> | undefined): Record<string, FeatureState> {
  const base = initialFeatures()
  if (!saved) return base
  for (const [id, state] of Object.entries(base)) {
    const previous = saved[id]
    if (!previous) continue
    const values = { ...state.values }
    for (const key of Object.keys(values)) if (key in (previous.values ?? {})) values[key] = previous.values[key]
    base[id] = { enabled: previous.enabled ?? state.enabled, values, order: previous.order ?? state.order }
  }
  return base
}

function load(): StudioState {
  const fallback: StudioState = { features: initialFeatures(), presets: {}, ui: { visible: true, world: 'frost', favorites: [], pins: [] } }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (parsed?.version !== VERSION) return fallback
    return {
      features: reconcile(parsed.features),
      presets: parsed.presets ?? {},
      ui: { ...fallback.ui, ...parsed.ui },
    }
  } catch {
    return fallback
  }
}

let state = load()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

function commit(next: StudioState) {
  state = next
  listeners.forEach(listener => listener())
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }))
    } catch {
      /* storage unavailable — the session still works */
    }
  }, 150)
}

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
    if (!current) return
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
      .map(feature => ({ id: feature.id, order: state.features[feature.id]?.order ?? feature.order ?? 500 }))
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

  /** Star or pin one control, keyed `featureId:control`. */
  toggleMark(kind: 'favorites' | 'pins', key: string) {
    const list = state.ui[kind]
    const next = list.includes(key) ? list.filter(item => item !== key) : [...list, key]
    commit({ ...state, ui: { ...state.ui, [kind]: next } })
  },

  setUI(patch: Partial<StudioState['ui']>) {
    commit({ ...state, ui: { ...state.ui, ...patch } })
  },
}

export function useStudio<T>(select: (state: StudioState) => T): T {
  const selector = useCallback(() => select(state), [select])
  return useSyncExternalStore(subscribe, selector, selector)
}

export function useFeatureState(id: string): FeatureState | undefined {
  return useSyncExternalStore(subscribe, () => state.features[id], () => state.features[id])
}
