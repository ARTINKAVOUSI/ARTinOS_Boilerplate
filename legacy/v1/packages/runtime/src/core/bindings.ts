import type { Unsubscribe } from './types'
import type { SignalRegistry } from './signals'
import type { ParameterRegistry } from './parameters'

export type BindingMode = 'add' | 'replace' | 'multiply'

export interface BindingDefinition {
  id: string
  source: string
  target: string
  mode?: BindingMode
  amount?: number
  offset?: number
  input?: [number, number]
  output?: [number, number]
  clamp?: boolean
  smooth?: number
  deadzone?: number
  curve?: number
  invert?: boolean
  enabled?: boolean
  priority?: number
}

interface BindingState extends BindingDefinition {
  current?: number
}

/**
 * Composes any number of realtime signal bindings onto parameter base values.
 * Each binding owns one stable named contribution. ParameterRegistry resolves
 * all active drivers deterministically without destroying the authored base value.
 */
export class BindingEngine {
  private bindings = new Map<string, BindingState>()
  private unsubs = new Map<string, Unsubscribe>()

  constructor(private signals: SignalRegistry, private parameters: ParameterRegistry) {}

  add(definition: BindingDefinition): Unsubscribe {
    this.remove(definition.id)
    const state: BindingState = { enabled: true, ...definition }
    this.bindings.set(definition.id, state)
    const unsubscribe = this.signals.subscribe(definition.source, (sample) => {
      if (state.enabled === false || typeof sample.value !== 'number') return
      const targetBase = this.parameters.getBase<number>(state.target)
      if (typeof targetBase !== 'number') return
      const mapped = transform(sample.value, state)
      const alpha = Math.max(0, Math.min(1, state.smooth ?? 1))
      state.current = state.current == null ? mapped : state.current + (mapped - state.current) * alpha
      this.parameters.setContribution(state.target, `binding:${state.id}`, state.current, {
        mode: state.mode ?? 'add',
        priority: state.priority ?? 0,
        source: 'binding',
        metadata: { signal: state.source },
      })
    })
    this.unsubs.set(definition.id, unsubscribe)
    return () => this.remove(definition.id)
  }

  update(id: string, patch: Partial<Omit<BindingDefinition, 'id'>>): boolean {
    const current = this.bindings.get(id)
    if (!current) return false
    const next = { ...current, ...patch, id }
    this.add(next)
    return true
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const state = this.bindings.get(id)
    if (!state) return false
    state.enabled = enabled
    this.parameters.setContributionEnabled(state.target, `binding:${state.id}`, enabled)
    return true
  }

  remove(id: string): boolean {
    const state = this.bindings.get(id)
    if (!state) return false
    this.unsubs.get(id)?.()
    this.unsubs.delete(id)
    this.bindings.delete(id)
    this.parameters.removeContribution(state.target, `binding:${state.id}`)
    return true
  }

  list(): BindingDefinition[] {
    return [...this.bindings.values()].map(({ current: _current, ...binding }) => binding)
  }

  listTarget(target: string): BindingDefinition[] {
    return this.list().filter((binding) => binding.target === target)
  }

  clear(): void {
    const active = [...this.bindings.values()]
    for (const unsubscribe of this.unsubs.values()) unsubscribe()
    this.unsubs.clear()
    this.bindings.clear()
    for (const binding of active) this.parameters.removeContribution(binding.target, `binding:${binding.id}`)
  }
}

function transform(value: number, binding: BindingDefinition): number {
  const input = binding.input ?? [0, 1]
  const output = binding.output ?? [0, 1]
  let raw = value
  if (binding.invert) raw = input[1] - (raw - input[0])
  const deadzone = Math.max(0, binding.deadzone ?? 0)
  if (Math.abs(raw) < deadzone) raw = 0
  let normalized = (raw - input[0]) / (input[1] - input[0] || 1)
  const curve = Math.max(0.01, binding.curve ?? 1)
  normalized = Math.sign(normalized) * Math.pow(Math.abs(normalized), curve)
  let mapped = output[0] + normalized * (output[1] - output[0])
  if (binding.clamp !== false) mapped = Math.max(Math.min(mapped, Math.max(...output)), Math.min(...output))
  return mapped * (binding.amount ?? 1) + (binding.offset ?? 0)
}
