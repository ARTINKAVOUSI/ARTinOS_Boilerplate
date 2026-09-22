import { SignalRegistry } from './signals'
import { ParameterRegistry, type ParameterWriteResult } from './parameters'
import { createDefaultParameterTypes } from './parameter-types'
import { BindingEngine } from './bindings'
import { TelemetryBus } from './telemetry'
import { ResourceRegistry } from './resources'
import { FrameCoordinator } from './frames'
import { UpdateScheduler } from './scheduler'
import { QualityManager } from './quality'
import { PresetRegistry } from './presets'
import { HistoryStore } from './history'
import { RuntimeLogger } from './logger'
import { ModuleRegistry } from './modules'
import { AutomationEngine } from './automation'
import { RuntimePersistence } from './persistence'
import { ActionRegistry, CommandRegistry, ProjectState, SignalProcessor } from './interactions'
import type {
  ParameterDefinition,
  ParameterValue,
  ParameterWriteOptions,
  RuntimeSnapshot,
  RuntimeSnapshotV2,
} from './types'

const clock = () => globalThis.performance?.now() ?? Date.now()

export class ArtinosRuntime {
  readonly signals = new SignalRegistry()
  readonly telemetry = new TelemetryBus()
  readonly resources = new ResourceRegistry()
  readonly quality = new QualityManager()
  readonly history = new HistoryStore()
  readonly logger = new RuntimeLogger()
  readonly modules = new ModuleRegistry()
  readonly commands = new CommandRegistry()
  readonly projectState = new ProjectState()
  readonly parameterTypes = createDefaultParameterTypes()
  readonly frames = new FrameCoordinator((task, error) => {
    this.telemetry.increment('runtime.errors')
    const message = error instanceof Error ? error.message : String(error)
    this.telemetry.set(`runtime.error.${task.id}`, message, { group: 'runtime' })
    this.logger.error(message, { source: task.id, data: error })
  })
  readonly scheduler = new UpdateScheduler(this.frames)
  readonly parameters = new ParameterRegistry(this.parameterTypes, this.scheduler)
  readonly bindings = new BindingEngine(this.signals, this.parameters)
  readonly presets = new PresetRegistry(this.parameters)
  readonly automation = new AutomationEngine(this.parameters)
  readonly actions = new ActionRegistry(this.signals, this.commands)
  readonly signalProcessor = new SignalProcessor(this.signals)
  readonly persistence: RuntimePersistence
  private disposed = false

  constructor() {
    this.persistence = new RuntimePersistence(this, { autosave: false })
    this.frames.add({
      id: 'core.automation',
      phase: 'parameters',
      priority: -100,
      run: ({ time }) => this.automation.evaluate(time),
    })
  }

  setParameter(
    id: string,
    value: ParameterValue,
    label?: string,
    options: ParameterWriteOptions = {},
  ): ParameterWriteResult {
    const state = this.parameters.state(id)
    const schedule = options.schedule ?? state?.definition.schedule
    const result = this.parameters.write(id, value, { source: 'ui', ...options, schedule })
    if (!result.accepted || result.previous === undefined || options.transient || options.recordHistory === false) return result
    this.history.push({
      id: `${id}:${clock()}`,
      parameterId: id,
      before: result.previous,
      after: result.value as ParameterValue,
      timestamp: clock(),
      label,
      source: options.source ?? 'ui',
    })
    return result
  }

  setParameters(
    values: Record<string, ParameterValue>,
    label = 'Set parameters',
    options: ParameterWriteOptions = {},
  ): Record<string, ParameterWriteResult> {
    const results: Record<string, ParameterWriteResult> = {}
    this.beginTransaction(label, options.source)
    try {
      for (const [id, value] of Object.entries(values)) results[id] = this.setParameter(id, value, label, options)
      this.commitTransaction()
    } catch (error) {
      this.cancelTransaction()
      throw error
    }
    return results
  }

  beginTransaction(label?: string, source?: ParameterWriteOptions['source']): void { this.history.begin(label, source) }
  commitTransaction(): void { this.history.commit() }
  cancelTransaction(): void { this.history.abort((id, value) => this.parameters.set(id, value, 'ui')) }
  /** Compatibility alias. A cancelled gesture restores authored origins. */
  abortTransaction(): void { this.cancelTransaction() }

  transact<T>(label: string, fn: () => T): T {
    this.history.begin(label)
    try {
      const result = fn()
      this.history.commit()
      return result
    } catch (error) {
      this.cancelTransaction()
      throw error
    }
  }

  undo(): boolean { return this.history.undo((id, value) => this.parameters.set(id, value, 'ui')) }
  redo(): boolean { return this.history.redo((id, value) => this.parameters.set(id, value, 'ui')) }

  snapshot(): RuntimeSnapshotV2 {
    const parameters: Record<string, unknown> = {}
    const parameterDefinitions: ParameterDefinition[] = []
    for (const state of this.parameters.list()) {
      if (state.definition.persist === false) continue
      parameters[state.definition.id] = this.parameters.serialize(state.definition.id)
      parameterDefinitions.push(state.definition)
    }
    return {
      version: 2,
      createdAt: Date.now(),
      parameters,
      parameterDefinitions,
      quality: this.quality.getState(),
      bindings: this.bindings.list() as unknown as Array<Record<string, unknown>>,
      automation: this.automation.list() as unknown as Array<Record<string, unknown>>,
      presets: this.presets.list(),
      actions: this.actions.list() as unknown as Array<Record<string, unknown>>,
      signalPipelines: this.signalProcessor.list() as unknown as Array<Record<string, unknown>>,
      projectState: this.projectState.snapshot(),
      metadata: { runtime: '@artinos/runtime', schema: 'artinos.project.v2' },
    }
  }

  restore(snapshot: RuntimeSnapshot): void {
    if (snapshot.version === 2) {
      for (const definition of snapshot.parameterDefinitions ?? []) {
        if (this.parameters.state(definition.id)) continue
        try { this.parameters.define(definition) }
        catch (error) { this.logger.warn(`Skipped parameter definition ${definition.id}`, { source: 'persistence', data: error }) }
      }
    }
    for (const [id, serialized] of Object.entries(snapshot.parameters ?? {})) {
      const state = this.parameters.state(id)
      if (!state) continue
      const value = snapshot.version === 2
        ? this.parameterTypes.deserialize(state.definition, serialized)
        : serialized as ParameterValue
      this.parameters.set(id, value, 'snapshot')
    }
    if (snapshot.quality) this.quality.setState(snapshot.quality as Parameters<QualityManager['setState']>[0])
    this.bindings.clear()
    for (const binding of snapshot.bindings ?? []) this.bindings.add(binding as never)
    this.automation.clear()
    for (const track of snapshot.automation ?? []) this.automation.add(track as never)
    for (const preset of snapshot.presets ?? []) this.presets.upsert(preset)
    this.actions.clear()
    for (const action of snapshot.actions ?? []) this.actions.add(action as never)
    this.signalProcessor.clear()
    for (const pipeline of snapshot.signalPipelines ?? []) this.signalProcessor.add(pipeline as never)
    this.projectState.restore(snapshot.projectState)
    this.logger.info('Runtime snapshot restored', { source: 'persistence' })
  }

  describe() {
    return {
      parameterTypes: this.parameterTypes.list().map(type => ({ id: type.id, presentations: [...type.presentations] })),
      parameters: this.parameters.list().map(state => this.parameters.describe(state.definition.id)),
      bindings: this.bindings.list(),
      automation: this.automation.list(),
      frameTasks: this.frames.list().map(task => ({ id: task.id, phase: task.phase, priority: task.priority, frequency: task.frequency })),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.persistence.dispose()
    this.bindings.clear()
    this.automation.clear()
    this.scheduler.dispose()
    this.frames.dispose()
  }
}

export const createArtinosRuntime = () => new ArtinosRuntime()
