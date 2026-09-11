import type { ComponentTreeNode } from './serialization'
import type { ControlRegistry, PresentationContext } from './registry'

export type SchemaValues = Record<string, unknown>
export type SchemaPredicate = (values: SchemaValues) => boolean

export interface ControlSchemaEntry {
  id?: string
  label?: string
  description?: string
  type?: string
  value?: unknown
  defaultValue?: unknown
  min?: number
  max?: number
  step?: number
  unit?: string | Record<string, unknown> | null
  options?: Array<{ label: string; value: string | number | boolean | null; disabled?: boolean }>
  presentation?: string
  group?: string
  section?: string
  order?: number
  tags?: string[]
  readOnly?: boolean | SchemaPredicate
  disabled?: boolean | SchemaPredicate
  visible?: boolean | SchemaPredicate
  layout?: Record<string, unknown>
  metadata?: Record<string, unknown>
  children?: ControlSchemaInput
}

export type ControlSchemaValue = unknown | ControlSchemaEntry
export type ControlSchemaInput = Record<string, ControlSchemaValue>

export interface ControlSchemaDefinition {
  id: string
  label?: string
  entries: ControlSchemaInput
  metadata?: Record<string, unknown>
}

export interface DefineControlsOptions {
  id?: string
  label?: string
  metadata?: Record<string, unknown>
}

export interface ParameterDefinitionLike {
  id: string
  label?: string
  type: string
  defaultValue: unknown
  min?: number
  max?: number
  step?: number
  unit?: string | Record<string, unknown> | null
  options?: ControlSchemaEntry['options']
  group?: string
  subgroup?: string
  description?: string
  presentation?: Record<string, unknown>
  layout?: Record<string, unknown>
  metadata?: Record<string, unknown>
  order?: number
  tags?: string[]
}

export interface ParameterTypeRegistryLike {
  infer(value: unknown, hints?: Record<string, unknown>): { id: string } | undefined
}

export interface ParameterMaterializer {
  parameters: {
    ensure(definition: ParameterDefinitionLike): unknown
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const ENTRY_KEYS = new Set([
  'id', 'label', 'description', 'type', 'value', 'defaultValue', 'min', 'max', 'step', 'unit',
  'options', 'presentation', 'group', 'section', 'order', 'tags', 'readOnly', 'disabled', 'visible',
  'layout', 'metadata', 'children',
])
const isEntry = (value: unknown): value is ControlSchemaEntry =>
  isRecord(value) && Object.keys(value).some(key => ENTRY_KEYS.has(key))

export function defineControls(schema: ControlSchemaInput, options: DefineControlsOptions = {}): ControlSchemaDefinition {
  return {
    id: options.id ?? 'controls',
    label: options.label,
    entries: schema,
    metadata: options.metadata,
  }
}

function inferKind(value: unknown): string {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value) && value.every(item => typeof item === 'number')) {
    if (value.length === 2) return 'vec2'
    if (value.length === 3) return 'vec3'
    if (value.length === 4) return 'vec4'
    return 'matrix'
  }
  if (isRecord(value)) {
    if (Array.isArray(value.stops)) return 'gradient'
    if (Array.isArray(value.points)) return 'curve'
    if (typeof value.id === 'string' && ('uri' in value || 'mimeType' in value)) return 'asset'
    if (['attack', 'decay', 'sustain', 'release'].every(key => typeof value[key] === 'number')) return 'envelope'
    return 'custom'
  }
  return 'custom'
}

export function inferParameterDefinition(
  id: string,
  input: ControlSchemaValue,
  typeRegistry?: ParameterTypeRegistryLike,
): ParameterDefinitionLike {
  const entry = isEntry(input) ? input : { value: input }
  const defaultValue = entry.defaultValue ?? entry.value ?? null
  const type = entry.type ?? typeRegistry?.infer(defaultValue, entry.metadata)?.id ?? inferKind(defaultValue)
  return {
    id: entry.id ?? id,
    label: entry.label ?? id.split('.').at(-1),
    type,
    defaultValue,
    min: entry.min,
    max: entry.max,
    step: entry.step,
    unit: entry.unit,
    options: entry.options,
    group: entry.group ?? entry.section,
    description: entry.description,
    presentation: entry.presentation ? { preferred: entry.presentation } : undefined,
    layout: entry.layout,
    metadata: {
      ...(entry.metadata ?? {}),
      visibleWhen: typeof entry.visible === 'function' ? entry.visible : undefined,
      disabledWhen: typeof entry.disabled === 'function' ? entry.disabled : undefined,
      readOnlyWhen: typeof entry.readOnly === 'function' ? entry.readOnly : undefined,
    },
    order: entry.order,
    tags: entry.tags,
  }
}

function evaluate(flag: boolean | SchemaPredicate | undefined, values: SchemaValues, fallback: boolean): boolean {
  return typeof flag === 'function' ? flag(values) : flag ?? fallback
}

function flatten(
  entries: ControlSchemaInput,
  prefix: string,
  output: Array<{ entry: ControlSchemaEntry; definition: ParameterDefinitionLike }>,
  typeRegistry?: ParameterTypeRegistryLike,
): void {
  for (const [key, input] of Object.entries(entries)) {
    const id = prefix ? `${prefix}.${key}` : key
    const entry = isEntry(input) ? input : { value: input }
    if (entry.children) {
      flatten(entry.children, entry.id ?? id, output, typeRegistry)
      continue
    }
    output.push({ entry, definition: inferParameterDefinition(id, entry, typeRegistry) })
  }
}

export function materializeSchema(
  runtime: ParameterMaterializer,
  schema: ControlSchemaDefinition,
  typeRegistry?: ParameterTypeRegistryLike,
): ParameterDefinitionLike[] {
  const flattened: Array<{ entry: ControlSchemaEntry; definition: ParameterDefinitionLike }> = []
  flatten(schema.entries, '', flattened, typeRegistry)
  for (const { definition } of flattened) runtime.parameters.ensure(definition)
  return flattened.map(item => item.definition)
}

export function schemaToComponentTree(
  schema: ControlSchemaDefinition,
  registry: ControlRegistry,
  context: PresentationContext = 'inspector',
  values: SchemaValues = {},
  typeRegistry?: ParameterTypeRegistryLike,
): ComponentTreeNode {
  const flattened: Array<{ entry: ControlSchemaEntry; definition: ParameterDefinitionLike }> = []
  flatten(schema.entries, '', flattened, typeRegistry)
  const groups = new Map<string, ComponentTreeNode[]>()
  for (const { entry, definition } of flattened) {
    if (!evaluate(entry.visible, values, true)) continue
    const presentation = registry.resolveControl({
      type: definition.type,
      context,
      hint: entry.presentation,
    })
    const group = definition.group ?? 'General'
    const children = groups.get(group) ?? []
    children.push({
      component: presentation?.component ?? 'unsupported-control',
      parameter: definition.id,
      presentation: presentation?.id ?? entry.presentation,
      state: {
        disabled: evaluate(entry.disabled, values, false),
        readonly: evaluate(entry.readOnly, values, false),
      },
      props: { label: definition.label, description: definition.description, type: definition.type },
      layout: definition.layout,
    })
    groups.set(group, children)
  }
  return {
    component: 'control-schema',
    props: { id: schema.id, label: schema.label },
    children: [...groups].map(([group, children]) => ({
      component: 'control-group',
      props: { label: group },
      children,
    })),
  }
}
