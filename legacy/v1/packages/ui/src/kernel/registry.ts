import { defineComponent, type ComponentDefinition } from './component'

export type ParameterKind = string
export type PresentationContext = 'inspector' | 'toolbar' | 'canvasOverlay' | 'node' | 'compact' | 'touch' | (string & {})
export type InputModality = 'pointer' | 'touch' | 'pen' | 'keyboard' | 'spatial' | (string & {})
export type Density = 'large' | 'medium' | 'compact' | 'micro'
export type ComponentImportance = 'primary' | 'secondary' | 'advanced'

export interface PresentationEntry {
  id: string
  component: string
  types: ParameterKind[]
  minWidth?: number
  maxWidth?: number
  contexts?: PresentationContext[]
  modalities?: InputModality[]
  densities?: Density[]
  geometry?: string[]
  importance?: ComponentImportance[]
  priority?: number
  metadata?: Record<string, unknown>
}

export interface ResolveQuery {
  type: ParameterKind
  width?: number
  context?: PresentationContext
  modality?: InputModality
  density?: Density
  geometry?: string
  importance?: ComponentImportance
  userPreference?: string[]
  hint?: string
}

export interface ComponentQuery {
  category?: ComponentDefinition['category']
  parameterKind?: string
  tag?: string
  text?: string
}

export class ComponentRegistry {
  private definitions = new Map<string, ComponentDefinition>()

  registerComponent(definition: ComponentDefinition): () => void {
    const previous = this.definitions.get(definition.id)
    this.definitions.set(definition.id, definition)
    return () => {
      if (this.definitions.get(definition.id) !== definition) return
      if (previous) this.definitions.set(previous.id, previous)
      else this.definitions.delete(definition.id)
    }
  }
  register(definition: ComponentDefinition): () => void { return this.registerComponent(definition) }
  get(id: string): ComponentDefinition | undefined { return this.definitions.get(id) }
  require(id: string): ComponentDefinition {
    const definition = this.get(id)
    if (!definition) throw new Error(`Unknown component: ${id}`)
    return definition
  }
  has(id: string): boolean { return this.definitions.has(id) }
  list(): ComponentDefinition[] { return [...this.definitions.values()] }
  describe(id: string): ComponentDefinition | undefined { return this.get(id) }
  query(query: ComponentQuery = {}): ComponentDefinition[] {
    const text = query.text?.trim().toLowerCase()
    return this.list().filter(definition => {
      if (query.category && definition.category !== query.category) return false
      if (query.parameterKind && !definition.semantics.parameterKinds?.includes(query.parameterKind)) return false
      if (query.tag && !definition.metadata.tags?.includes(query.tag)) return false
      if (text && !`${definition.id} ${definition.name} ${definition.metadata.description ?? ''}`.toLowerCase().includes(text)) return false
      return true
    })
  }
}

export class ControlRegistry extends ComponentRegistry {
  private controls = new Map<string, PresentationEntry>()

  registerControl(entry: PresentationEntry): () => void {
    if (!this.has(entry.component)) throw new Error(`Control ${entry.id} references unknown component ${entry.component}`)
    const previous = this.controls.get(entry.id)
    const normalized = {
      ...entry,
      types: [...entry.types],
      contexts: entry.contexts ? [...entry.contexts] : undefined,
      modalities: entry.modalities ? [...entry.modalities] : undefined,
      densities: entry.densities ? [...entry.densities] : undefined,
      geometry: entry.geometry ? [...entry.geometry] : undefined,
      importance: entry.importance ? [...entry.importance] : undefined,
    }
    this.controls.set(entry.id, normalized)
    return () => {
      if (this.controls.get(entry.id) !== normalized) return
      if (previous) this.controls.set(previous.id, previous)
      else this.controls.delete(entry.id)
    }
  }

  /** Compatibility helper for older plug-ins registering a type and entry list. */
  registerPresentations(type: ParameterKind, presentations: Array<Omit<PresentationEntry, 'types'> & { types?: ParameterKind[] }>): this {
    for (const presentation of presentations) this.registerControl({ ...presentation, types: presentation.types ?? [type] })
    return this
  }

  listControls(): PresentationEntry[] { return [...this.controls.values()] }
  presentationsFor(type: ParameterKind, query: Omit<ResolveQuery, 'type'> = {}): PresentationEntry[] {
    return this.eligible({ ...query, type })
  }
  presentations(type: ParameterKind): PresentationEntry[] { return this.presentationsFor(type) }
  eligible(query: ResolveQuery): PresentationEntry[] {
    const width = query.width ?? Infinity
    const preference = query.userPreference ?? []
    return this.listControls()
      .filter(entry => entry.types.includes(query.type))
      .filter(entry => (entry.minWidth ?? 0) <= width && (entry.maxWidth ?? Infinity) >= width)
      .filter(entry => !entry.contexts?.length || !query.context || entry.contexts.includes(query.context))
      .filter(entry => !entry.modalities?.length || !query.modality || entry.modalities.includes(query.modality))
      .filter(entry => !entry.densities?.length || !query.density || entry.densities.includes(query.density))
      .filter(entry => !entry.geometry?.length || !query.geometry || entry.geometry.includes(query.geometry))
      .filter(entry => !entry.importance?.length || !query.importance || entry.importance.includes(query.importance))
      .sort((a, b) => {
        const preferredA = preference.indexOf(a.id)
        const preferredB = preference.indexOf(b.id)
        if (preferredA >= 0 || preferredB >= 0) return (preferredA < 0 ? Infinity : preferredA) - (preferredB < 0 ? Infinity : preferredB)
        return (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id)
      })
  }
  resolveControl(query: ResolveQuery): PresentationEntry | undefined {
    if (query.hint) {
      const hinted = this.controls.get(query.hint)
      if (hinted?.types.includes(query.type) && this.eligible({ ...query, hint: undefined }).some(entry => entry.id === hinted.id)) return hinted
    }
    return this.eligible(query)[0] ?? this.listControls().find(entry => entry.types.includes(query.type))
  }
  resolve(query: ResolveQuery): PresentationEntry | undefined { return this.resolveControl(query) }
  types(): ParameterKind[] { return [...new Set(this.listControls().flatMap(entry => entry.types))] }
}

export function densityFor(width: number): Density {
  if (width >= 260) return 'large'
  if (width >= 168) return 'medium'
  if (width >= 96) return 'compact'
  return 'micro'
}

/** Legacy metadata input retained while primitives migrate to full definitions. */
export interface ComponentMeta {
  name: string
  slots: string[]
  states: string[]
  parameters: ParameterKind[]
  events: string[]
  tokens: string[]
  presentations: string[]
  accessibility: {
    role?: string
    keyboard: string[]
    announces?: string[]
  }
}

export function defineMeta(meta: ComponentMeta): ComponentDefinition {
  const id = meta.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  return defineComponent({
    id,
    name: meta.name,
    category: meta.parameters.length ? 'control' : 'primitive',
    state: { initial: { status: meta.states[0] ?? 'idle' }, states: meta.states },
    events: meta.events,
    transitions: [],
    interactions: meta.events,
    accessibility: meta.accessibility,
    semantics: { purpose: meta.name, parameterKinds: meta.parameters },
    slots: meta.slots,
    tokens: meta.tokens,
    layout: { presentations: meta.presentations, adaptive: true },
    metadata: { status: 'stable', compatibility: 'defineMeta' },
  })
}
