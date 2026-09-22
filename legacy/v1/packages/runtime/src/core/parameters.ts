import { defaultParameterTypes, type ParameterTypeRegistry } from './parameter-types'
import type { ScheduledHandle, UpdateScheduler } from './scheduler'
import type {
  ParameterDefinition,
  ParameterSourceInfo,
  ParameterValidationResult,
  ParameterValue,
  ParameterWriteOptions,
  Unsubscribe,
} from './types'

export type ParameterSource = ParameterSourceInfo['kind']
export type ParameterContributionMode = 'replace' | 'add' | 'multiply' | 'min' | 'max'

export interface ParameterContribution<T extends ParameterValue = ParameterValue> {
  id: string
  value: T
  mode: ParameterContributionMode
  priority: number
  source: ParameterSource
  enabled: boolean
  updatedAt: number
  metadata?: Record<string, unknown>
}

export interface ParameterState<T extends ParameterValue = ParameterValue> {
  definition: ParameterDefinition<T>
  baseValue: T
  resolvedValue: T
  updatedAt: number
  baseRevision: number
  resolvedRevision: number
  /** Last writer of baseValue. */
  source?: ParameterSource
  /** Highest-priority active resolved writer. */
  resolvedSource?: ParameterSource
  /** Set when a writer rejects the value; drives the control fault state. */
  fault?: string
  validation?: ParameterValidationResult
  contributions: Map<string, ParameterContribution<T>>
}

export interface ParameterWriteResult<T extends ParameterValue = ParameterValue> {
  accepted: boolean
  id: string
  value?: T
  previous?: T
  validation: ParameterValidationResult
  scheduled?: ScheduledHandle
}

export interface ParameterContributionOptions {
  mode?: ParameterContributionMode
  priority?: number
  source?: ParameterSource
  enabled?: boolean
  metadata?: Record<string, unknown>
}

const pass: ParameterValidationResult = { valid: true }
const now = () => globalThis.performance?.now() ?? Date.now()
const equal = (a: ParameterValue, b: ParameterValue): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export class ParameterRegistry {
  revision = 0
  baseRevision = 0
  resolvedRevision = 0
  private states = new Map<string, ParameterState>()
  private baseListeners = new Map<string, Set<() => void>>()
  private resolvedListeners = new Map<string, Set<() => void>>()
  private baseAnyListeners = new Set<() => void>()
  private resolvedAnyListeners = new Set<() => void>()

  constructor(
    readonly types: ParameterTypeRegistry = defaultParameterTypes,
    private scheduler?: UpdateScheduler,
  ) {}

  define<T extends ParameterValue>(definition: ParameterDefinition<T>): ParameterState<T> {
    const existing = this.states.get(definition.id) as ParameterState<T> | undefined
    if (existing) return existing
    const type = this.types.require<T>(definition.type)
    const defaultValue = type.normalize(definition.defaultValue, definition)
    const validation = this.types.validate(definition, defaultValue)
    if (!validation.valid) throw new Error(`Invalid default for parameter ${definition.id}: ${validation.message ?? validation.code ?? 'unknown error'}`)
    const state: ParameterState<T> = {
      definition: { ...definition, defaultValue },
      baseValue: defaultValue,
      resolvedValue: defaultValue,
      updatedAt: now(),
      baseRevision: 0,
      resolvedRevision: 0,
      validation,
      contributions: new Map(),
    }
    this.states.set(definition.id, state)
    this.notifyBase(definition.id)
    this.notifyResolved(definition.id)
    return state
  }

  ensure<T extends ParameterValue>(definition: ParameterDefinition<T>): ParameterState<T> { return this.define(definition) }

  write<T extends ParameterValue>(id: string, value: unknown, options: ParameterWriteOptions = {}): ParameterWriteResult<T> {
    const state = this.states.get(id) as ParameterState<T> | undefined
    if (!state) return { accepted: false, id, validation: { valid: false, code: 'unknown', message: `Unknown parameter: ${id}` } }
    const validation = this.types.validate(state.definition, value)
    if (!validation.valid) {
      state.validation = validation
      state.fault = validation.message ?? validation.code ?? 'Invalid value'
      state.baseRevision++
      this.notifyBase(id)
      return { accepted: false, id, previous: state.baseValue, validation }
    }
    const normalized = this.types.normalize(state.definition, value)
    const apply = (next: T) => this.applyBase(state, next, options.source ?? 'ui')
    if (options.schedule && options.schedule !== 'immediate' && this.scheduler) {
      const scheduled = this.scheduler.schedule(`parameter:${id}`, options.schedule, apply, {
        value: normalized,
        delayMs: Number(state.definition.metadata?.debounceMs ?? 120),
        intervalMs: Number(state.definition.metadata?.throttleMs ?? 50),
      })
      return { accepted: true, id, value: normalized, previous: state.baseValue, validation, scheduled }
    }
    const previous = state.baseValue
    apply(normalized)
    return { accepted: true, id, value: normalized, previous, validation }
  }

  set<T extends ParameterValue>(id: string, value: T, source: ParameterSource = 'ui'): void {
    const result = this.write<T>(id, value, { source })
    if (!result.accepted && result.validation.code === 'unknown') throw new Error(result.validation.message)
  }

  setFault(id: string, fault?: string): void {
    const state = this.states.get(id)
    if (!state || state.fault === fault) return
    state.fault = fault
    state.validation = fault ? { valid: false, code: 'external', message: fault } : pass
    state.baseRevision++
    this.notifyBase(id)
  }

  setContribution<T extends ParameterValue>(
    id: string,
    contributionId: string,
    value: T,
    options: ParameterContributionOptions = {},
  ): boolean {
    const state = this.states.get(id) as ParameterState<T> | undefined
    if (!state) return false
    const mode = options.mode ?? 'replace'
    if (mode !== 'replace' && (typeof value !== 'number' || typeof state.baseValue !== 'number')) {
      state.fault = `Contribution mode ${mode} requires numeric values`
      this.notifyResolved(id)
      return false
    }
    state.contributions.set(contributionId, {
      id: contributionId,
      value,
      mode,
      priority: options.priority ?? 0,
      source: options.source ?? 'binding',
      enabled: options.enabled ?? true,
      updatedAt: now(),
      metadata: options.metadata,
    })
    this.resolve(state)
    return true
  }

  removeContribution(id: string, contributionId: string): boolean {
    const state = this.states.get(id)
    if (!state?.contributions.delete(contributionId)) return false
    this.resolve(state)
    return true
  }

  setContributionEnabled(id: string, contributionId: string, enabled: boolean): boolean {
    const state = this.states.get(id)
    const contribution = state?.contributions.get(contributionId)
    if (!state || !contribution || contribution.enabled === enabled) return Boolean(contribution)
    contribution.enabled = enabled
    contribution.updatedAt = now()
    this.resolve(state)
    return true
  }

  sources(id: string): ParameterContribution[] {
    const state = this.states.get(id)
    return state ? this.sortedContributions(state).map(source => ({ ...source })) : []
  }

  /** Compatibility path. New realtime drivers should use a stable named contribution. */
  setResolved<T extends ParameterValue>(id: string, value: T, source: ParameterSource = 'binding'): void {
    this.setContribution(id, `legacy:${source}`, value, { source, mode: 'replace' })
  }

  clearResolved(id: string, source: ParameterSource = 'binding'): void {
    this.removeContribution(id, `legacy:${source}`)
  }

  get<T extends ParameterValue = ParameterValue>(id: string): T | undefined {
    return this.states.get(id)?.resolvedValue as T | undefined
  }
  getResolved<T extends ParameterValue = ParameterValue>(id: string): T | undefined { return this.get<T>(id) }
  getBase<T extends ParameterValue = ParameterValue>(id: string): T | undefined {
    return this.states.get(id)?.baseValue as T | undefined
  }

  state(id: string): ParameterState | undefined { return this.states.get(id) }
  list(): ParameterState[] { return [...this.states.values()] }
  touch(id: string): void {
    const state = this.states.get(id)
    if (!state) return
    state.baseRevision++
    this.notifyBase(id)
  }
  serialize(id: string): unknown {
    const state = this.states.get(id)
    return state ? this.types.serialize(state.definition, state.baseValue) : undefined
  }
  describe(id: string) {
    const state = this.states.get(id)
    if (!state) return undefined
    const type = this.types.require(state.definition.type)
    return {
      definition: state.definition,
      baseValue: state.baseValue,
      resolvedValue: state.resolvedValue,
      baseRevision: state.baseRevision,
      resolvedRevision: state.resolvedRevision,
      validation: state.validation,
      fault: state.fault,
      presentations: [...type.presentations],
      sources: this.sources(id),
    }
  }

  subscribeBase(id: string, fn: () => void): Unsubscribe {
    const set = this.baseListeners.get(id) ?? new Set()
    set.add(fn); this.baseListeners.set(id, set)
    return () => { set.delete(fn); if (!set.size) this.baseListeners.delete(id) }
  }
  /** Compatibility alias for realtime consumers. UI authoring code should use subscribeBase. */
  subscribe(id: string, fn: () => void): Unsubscribe { return this.subscribeResolved(id, fn) }
  subscribeResolved(id: string, fn: () => void): Unsubscribe {
    const set = this.resolvedListeners.get(id) ?? new Set()
    set.add(fn); this.resolvedListeners.set(id, set)
    return () => { set.delete(fn); if (!set.size) this.resolvedListeners.delete(id) }
  }
  subscribeResolvedSnapshot(id: string, fn: () => void, intervalMs = 100): Unsubscribe {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = this.subscribeResolved(id, () => {
      timer ??= setTimeout(() => { timer = undefined; fn() }, Math.max(0, intervalMs))
    })
    return () => { unsubscribe(); if (timer) clearTimeout(timer) }
  }
  subscribeAllBase(fn: () => void): Unsubscribe { this.baseAnyListeners.add(fn); return () => this.baseAnyListeners.delete(fn) }
  subscribeAll(fn: () => void): Unsubscribe { this.resolvedAnyListeners.add(fn); return () => this.resolvedAnyListeners.delete(fn) }

  private applyBase<T extends ParameterValue>(state: ParameterState<T>, value: T, source: ParameterSource): void {
    const changed = !equal(state.baseValue, value)
    state.baseValue = value
    state.updatedAt = now()
    state.source = source
    state.validation = pass
    state.fault = undefined
    if (changed) {
      state.baseRevision++
      this.notifyBase(state.definition.id)
    }
    this.resolve(state)
  }

  private resolve<T extends ParameterValue>(state: ParameterState<T>): void {
    let resolved: ParameterValue = state.baseValue
    let resolvedSource: ParameterSource = state.source ?? 'ui'
    for (const contribution of this.sortedContributions(state)) {
      if (!contribution.enabled) continue
      if (contribution.mode === 'replace') resolved = contribution.value
      else if (typeof resolved === 'number' && typeof contribution.value === 'number') {
        if (contribution.mode === 'add') resolved += contribution.value
        else if (contribution.mode === 'multiply') resolved *= contribution.value
        else if (contribution.mode === 'min') resolved = Math.min(resolved, contribution.value)
        else if (contribution.mode === 'max') resolved = Math.max(resolved, contribution.value)
      }
      resolvedSource = contribution.source
    }
    if (equal(state.resolvedValue, resolved)) return
    state.resolvedValue = resolved as T
    state.resolvedSource = resolvedSource
    state.updatedAt = now()
    state.resolvedRevision++
    this.notifyResolved(state.definition.id)
  }

  private sortedContributions<T extends ParameterValue>(state: ParameterState<T>): ParameterContribution<T>[] {
    return [...state.contributions.values()].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
  }
  private notifyBase(id: string) {
    this.baseRevision++; this.revision++
    this.baseListeners.get(id)?.forEach(fn => fn())
    this.baseAnyListeners.forEach(fn => fn())
  }
  private notifyResolved(id: string) {
    this.resolvedRevision++; this.revision++
    this.resolvedListeners.get(id)?.forEach(fn => fn())
    this.resolvedAnyListeners.forEach(fn => fn())
  }
}
