import type { ParameterRegistry } from './parameters'
import type { ParameterValue, Unsubscribe } from './types'

export interface Preset {
  id: string
  label: string
  group?: string
  description?: string
  values: Record<string, ParameterValue>
  tags?: string[]
  favorite?: boolean
  createdAt?: number
  updatedAt?: number
}

export interface CapturePresetOptions {
  ids?: string[]
  group?: string
  description?: string
  tags?: string[]
  favorite?: boolean
}

const copyValue = <T>(value: T): T => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value)) as T

export class PresetRegistry {
  private presets = new Map<string, Preset>()
  private listeners = new Set<() => void>()
  revision = 0

  constructor(private parameters: ParameterRegistry) {}

  register(preset: Preset): Unsubscribe {
    const normalized = this.normalize(preset)
    const previous = this.presets.get(preset.id)
    this.presets.set(preset.id, normalized)
    this.bump()
    return () => {
      if (this.presets.get(preset.id) !== normalized) return
      if (previous) this.presets.set(previous.id, previous)
      else this.presets.delete(preset.id)
      this.bump()
    }
  }

  upsert(preset: Preset): Preset {
    const normalized = this.normalize({ ...this.presets.get(preset.id), ...preset })
    this.presets.set(preset.id, normalized)
    this.bump()
    return normalized
  }
  get(id: string): Preset | undefined { return this.presets.get(id) }
  remove(id: string): boolean { const ok = this.presets.delete(id); if (ok) this.bump(); return ok }
  clear(group?: string): void {
    if (group) {
      let changed = false
      for (const [id, preset] of this.presets) if (preset.group === group) { this.presets.delete(id); changed = true }
      if (changed) this.bump()
      return
    }
    if (this.presets.size) { this.presets.clear(); this.bump() }
  }
  list(group?: string): Preset[] {
    const values = [...this.presets.values()]
    return group ? values.filter(preset => preset.group === group) : values
  }

  capture(id: string, label: string, ids?: string[], group?: string): Preset
  capture(id: string, label: string, options?: CapturePresetOptions): Preset
  capture(id: string, label: string, idsOrOptions?: string[] | CapturePresetOptions, legacyGroup?: string): Preset {
    const options: CapturePresetOptions = Array.isArray(idsOrOptions)
      ? { ids: idsOrOptions, group: legacyGroup }
      : idsOrOptions ?? {}
    const selected = options.ids ?? this.parameters.list()
      .filter(state => state.definition.persist !== false)
      .map(state => state.definition.id)
    const values: Record<string, ParameterValue> = {}
    for (const key of selected) {
      const value = this.parameters.getBase(key)
      if (value !== undefined) values[key] = copyValue(value)
    }
    return this.upsert({
      id, label, values,
      group: options.group,
      description: options.description,
      tags: options.tags,
      favorite: options.favorite,
    })
  }

  apply(id: string, ids?: string[]): boolean {
    const preset = this.presets.get(id)
    if (!preset) return false
    const allowed = ids ? new Set(ids) : undefined
    for (const [key, value] of Object.entries(preset.values)) {
      if ((!allowed || allowed.has(key)) && this.parameters.state(key)) this.parameters.set(key, copyValue(value), 'preset')
    }
    return true
  }

  duplicate(id: string, nextId: string, label?: string): Preset | undefined {
    const preset = this.presets.get(id)
    if (!preset || this.presets.has(nextId)) return undefined
    return this.upsert({ ...copyValue(preset), id: nextId, label: label ?? `${preset.label} Copy`, createdAt: Date.now() })
  }

  rename(id: string, label: string): boolean {
    const preset = this.presets.get(id)
    if (!preset) return false
    this.upsert({ ...preset, label })
    return true
  }
  setTags(id: string, tags: string[]): boolean {
    const preset = this.presets.get(id)
    if (!preset) return false
    this.upsert({ ...preset, tags: [...new Set(tags)] })
    return true
  }
  setFavorite(id: string, favorite: boolean): boolean {
    const preset = this.presets.get(id)
    if (!preset) return false
    this.upsert({ ...preset, favorite })
    return true
  }

  interpolate(fromId: string, toId: string, amount: number): Record<string, ParameterValue> | undefined {
    const from = this.presets.get(fromId)
    const to = this.presets.get(toId)
    if (!from || !to) return undefined
    const result: Record<string, ParameterValue> = {}
    for (const id of new Set([...Object.keys(from.values), ...Object.keys(to.values)])) {
      const a = from.values[id]
      const b = to.values[id]
      const state = this.parameters.state(id)
      if (a === undefined) result[id] = copyValue(b)
      else if (b === undefined) result[id] = copyValue(a)
      else if (state) result[id] = this.parameters.types.interpolate(state.definition, a, b, amount)
      else result[id] = copyValue(amount < 0.5 ? a : b)
    }
    return result
  }

  morph(fromId: string, toId: string, amount: number): boolean {
    const values = this.interpolate(fromId, toId, amount)
    if (!values) return false
    for (const [id, value] of Object.entries(values)) if (this.parameters.state(id)) this.parameters.set(id, value, 'preset')
    return true
  }

  export(ids?: string[]): string {
    const selected = ids ? ids.map(id => this.presets.get(id)).filter((preset): preset is Preset => Boolean(preset)) : this.list()
    return JSON.stringify({ version: 1, presets: selected }, null, 2)
  }
  import(raw: string, replace = false): number {
    const parsed = JSON.parse(raw) as { version?: number; presets?: Preset[] }
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) throw new Error('Unsupported preset payload')
    if (replace) this.clear()
    for (const preset of parsed.presets) this.upsert(preset)
    return parsed.presets.length
  }

  subscribe(fn: () => void): Unsubscribe { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private normalize(preset: Preset): Preset {
    const createdAt = preset.createdAt ?? Date.now()
    return {
      ...preset,
      values: copyValue(preset.values),
      tags: preset.tags ? [...new Set(preset.tags)] : undefined,
      createdAt,
      updatedAt: Date.now(),
    }
  }
  private bump(): void { this.revision++; this.listeners.forEach(fn => fn()) }
}
