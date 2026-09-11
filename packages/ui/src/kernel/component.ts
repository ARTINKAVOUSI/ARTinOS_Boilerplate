export type ComponentCategory = 'primitive' | 'control' | 'composite'
export type ComponentState = Record<string, string | number | boolean | null>
export type ComponentDataAttributes = Record<`data-${string}`, string | undefined>

export interface ComponentTransition<State extends ComponentState = ComponentState, Event extends string = string> {
  event: Event
  from?: Partial<State>
  to: Partial<State>
  guard?: string
}

export interface ComponentAccessibility {
  role?: string
  keyboard?: string[]
  announces?: string[]
  focusable?: boolean
  labelRequired?: boolean
  valueText?: string
}

export interface ComponentSemantics {
  purpose: string
  valueRole?: string
  parameterKinds?: string[]
  contexts?: string[]
}

export interface ComponentLayoutContract {
  minCells?: number
  idealCells?: number
  maxCells?: number
  minWidth?: number
  minHeight?: number
  adaptive?: boolean
  presentations?: string[]
}

export interface ComponentDefinition<
  State extends ComponentState = ComponentState,
  Event extends string = string,
  Slot extends string = string,
> {
  id: string
  name: string
  version: number
  category: ComponentCategory
  state: {
    initial: State
    states?: string[]
  }
  events: Event[]
  transitions: Array<ComponentTransition<State, Event>>
  constraints: Record<string, unknown>
  geometry: Record<string, unknown>
  interactions: string[]
  accessibility: ComponentAccessibility
  semantics: ComponentSemantics
  slots: Slot[]
  tokens: string[]
  motion: string | Record<string, unknown>
  physics: string | Record<string, unknown>
  layout: ComponentLayoutContract
  serialization: {
    version: number
    fields?: string[]
  }
  metadata: {
    description?: string
    tags?: string[]
    source?: string
    status?: 'experimental' | 'stable' | 'deprecated'
    since?: string
    [key: string]: unknown
  }
}

export type ComponentDefinitionInput<
  State extends ComponentState,
  Event extends string,
  Slot extends string,
> = Omit<ComponentDefinition<State, Event, Slot>, 'version' | 'transitions' | 'constraints' | 'geometry' | 'interactions' | 'tokens' | 'motion' | 'physics' | 'layout' | 'serialization' | 'metadata'> & {
  version?: number
  transitions?: Array<ComponentTransition<State, Event>>
  constraints?: Record<string, unknown>
  geometry?: Record<string, unknown>
  interactions?: string[]
  tokens?: string[]
  motion?: string | Record<string, unknown>
  physics?: string | Record<string, unknown>
  layout?: ComponentLayoutContract
  serialization?: ComponentDefinition<State, Event, Slot>['serialization']
  metadata?: ComponentDefinition<State, Event, Slot>['metadata']
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)]
const freezeList = <T>(values: T[]): T[] => Object.freeze([...values]) as T[]
const freezeRecord = <T extends object>(value: T): T => Object.freeze({ ...value })

export function defineComponent<
  State extends ComponentState,
  Event extends string,
  Slot extends string,
>(input: ComponentDefinitionInput<State, Event, Slot>): ComponentDefinition<State, Event, Slot> {
  if (!input.id.trim()) throw new Error('Component id is required')
  if (!input.name.trim()) throw new Error(`Component ${input.id} requires a name`)
  const definition: ComponentDefinition<State, Event, Slot> = {
    ...input,
    version: input.version ?? 1,
    state: freezeRecord({ ...input.state, initial: freezeRecord(input.state.initial) }),
    events: freezeList(input.events),
    transitions: freezeList(input.transitions ?? []),
    constraints: freezeRecord(input.constraints ?? {}),
    geometry: freezeRecord(input.geometry ?? {}),
    interactions: freezeList(input.interactions ?? []),
    accessibility: freezeRecord(input.accessibility),
    semantics: freezeRecord(input.semantics),
    slots: freezeList(input.slots),
    tokens: freezeList(input.tokens ?? []),
    motion: typeof input.motion === 'string' ? input.motion : freezeRecord(input.motion ?? {}),
    physics: typeof input.physics === 'string' ? input.physics : freezeRecord(input.physics ?? {}),
    layout: freezeRecord(input.layout ?? {}),
    serialization: freezeRecord(input.serialization ?? { version: 1 }),
    metadata: freezeRecord(input.metadata ?? {}),
  }
  return Object.freeze(definition)
}

export type ComponentPatch<
  State extends ComponentState,
  Event extends string,
  Slot extends string,
> = Partial<Omit<ComponentDefinitionInput<State, Event, Slot>, 'id' | 'name' | 'category' | 'state' | 'events' | 'slots' | 'accessibility' | 'semantics'>> & {
  id: string
  name?: string
  state?: Partial<ComponentDefinition<State, Event, Slot>['state']>
  events?: Event[]
  slots?: Slot[]
  accessibility?: Partial<ComponentAccessibility>
  semantics?: Partial<ComponentSemantics>
}

export function deriveComponent<
  State extends ComponentState,
  Event extends string,
  Slot extends string,
>(
  base: ComponentDefinition<State, Event, Slot>,
  patch: ComponentPatch<State, Event, Slot>,
): ComponentDefinition<State, Event, Slot> {
  return defineComponent({
    ...base,
    ...patch,
    name: patch.name ?? base.name,
    category: base.category,
    state: {
      ...base.state,
      ...patch.state,
      initial: { ...base.state.initial, ...(patch.state?.initial ?? {}) },
      states: unique([...(base.state.states ?? []), ...(patch.state?.states ?? [])]),
    },
    events: unique([...base.events, ...(patch.events ?? [])]),
    transitions: [...base.transitions, ...(patch.transitions ?? [])],
    constraints: { ...base.constraints, ...(patch.constraints ?? {}) },
    geometry: { ...base.geometry, ...(patch.geometry ?? {}) },
    interactions: unique([...base.interactions, ...(patch.interactions ?? [])]),
    accessibility: { ...base.accessibility, ...(patch.accessibility ?? {}) },
    semantics: { ...base.semantics, ...(patch.semantics ?? {}) },
    slots: unique([...base.slots, ...(patch.slots ?? [])]),
    tokens: unique([...base.tokens, ...(patch.tokens ?? [])]),
    layout: { ...base.layout, ...(patch.layout ?? {}) },
    serialization: { ...base.serialization, ...(patch.serialization ?? {}) },
    metadata: { ...base.metadata, ...(patch.metadata ?? {}) },
  })
}

export function componentStateAttributes(snapshot: ComponentState): ComponentDataAttributes {
  const attributes: ComponentDataAttributes = {}
  for (const [key, value] of Object.entries(snapshot)) {
    const attribute = `data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}` as const
    attributes[attribute] = value === false || value === null ? undefined : value === true ? '' : String(value)
  }
  return attributes
}
