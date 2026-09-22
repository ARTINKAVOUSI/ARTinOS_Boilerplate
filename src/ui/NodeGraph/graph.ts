/**
 * The node graph model: domains, schema, validation and numeric evaluation.
 *
 * Five domains share one model. `signal` and `parameter` graphs shape numbers;
 * `scene` graphs drive real objects; `render` graphs drive the effect chain;
 * `gpu` graphs compile to TSL nodes (see gpu.ts). Every domain is evaluated
 * against the same numeric core, so any node can be driven by a live signal.
 *
 * Nothing here touches React, the DOM or any host application. A graph reaches
 * the outside world only through the `GraphHost` callbacks passed to
 * `evaluate`, so the same graph runs against a studio, a test or a plain page.
 */

export type GraphDomain = 'signal' | 'parameter' | 'scene' | 'render' | 'gpu'
export type GraphValueType = 'number' | 'boolean' | 'object' | 'node' | 'any'

export interface GraphPort {
  id: string
  label?: string
  type: GraphValueType
  /** Accepts several wires (add, multiply, min, max). */
  multiple?: boolean
  required?: boolean
}

/** A value typed into the node itself, used when the matching port is unwired. */
export interface GraphField {
  id: string
  label: string
  kind: 'number' | 'boolean' | 'select' | 'text' | 'signal' | 'parameter' | 'effect' | 'effect-parameter' | 'scene-object' | 'vector3'
  default: unknown
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
  description?: string
}

export type GraphCategory = 'Source' | 'Math' | 'Shape' | 'Logic' | 'Output' | 'Scene' | 'Render' | 'GPU'

export interface GraphNodeSchema {
  type: string
  label: string
  category: GraphCategory
  domains: readonly GraphDomain[]
  description: string
  inputs: readonly GraphPort[]
  outputs: readonly GraphPort[]
  fields: readonly GraphField[]
}

export interface GraphNode {
  id: string
  type: string
  /** Renamed by the user; the schema label is the default. */
  label?: string
  x: number
  y: number
  data?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  from: string
  /** Output port on `from`. Defaults to `value`. */
  output?: string
  to: string
  /** Input port on `to`. Defaults to `value`. */
  input?: string
  /** Position among several wires into the same multi-input port. */
  order?: number
}

/** A named set of nodes that can be collapsed to one box. */
export interface GraphGroup {
  id: string
  label: string
  nodes: string[]
  collapsed?: boolean
}

export interface GraphDefinition {
  domain: GraphDomain
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups?: GraphGroup[]
}

export interface GraphDiagnostic {
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
  edgeId?: string
}

/** A scene object as the graph sees it — enough to drive it, nothing more. */
export interface GraphObject {
  name: string
  position: { set(x: number, y: number, z: number): void }
  rotation: { set(x: number, y: number, z: number): void }
  scale: { set(x: number, y: number, z: number): void }
  visible: boolean
  material?: unknown
}

/** Everything a graph can reach outside itself. The host implements it. */
export interface GraphHost {
  readSignal: (id: string) => number
  writeSignal: (id: string, value: number) => void
  readParameter: (id: string) => number
  writeParameter: (id: string, value: number) => void
  /** Scene domain. */
  findObject?: (name: string) => GraphObject | undefined
  writeMaterial?: (object: GraphObject, property: string, value: number) => string | undefined
  /** Render domain. */
  setEffectEnabled?: (id: string, enabled: boolean) => void
  setEffectOrder?: (id: string, order: number) => void
  setEffectParameter?: (id: string, parameter: string, value: number) => void
  hasEffect?: (id: string) => boolean
}

export interface GraphContext extends GraphHost {
  /** Seconds since the graph started running. */
  time: number
  /** Seconds since the previous evaluation. */
  delta: number
  /** Survives between frames; `smooth` keeps its state here. */
  memory: Map<string, number>
  /** Filled with anything the evaluation could not do. */
  diagnostics?: GraphDiagnostic[]
}

const title = (id: string) => id.replace(/[-_]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, letter => letter.toUpperCase())
const port = (id: string, type: GraphValueType = 'number', extra: Partial<GraphPort> = {}): GraphPort => ({ id, label: title(id), type, ...extra })
const out = (type: GraphValueType = 'number'): readonly GraphPort[] => [port('value', type)]
const num = (id: string, value: number, extra: Partial<GraphField> = {}): GraphField => ({ id, label: title(id), kind: 'number', default: value, step: 0.01, ...extra })

const NUMERIC_DOMAINS: readonly GraphDomain[] = ['signal', 'parameter', 'scene', 'render']
const ALL_DOMAINS: readonly GraphDomain[] = ['signal', 'parameter', 'scene', 'render', 'gpu']
const unary = (type: string, label: string, description: string, domains = NUMERIC_DOMAINS): GraphNodeSchema => ({
  type,
  label,
  category: 'Math',
  domains,
  description,
  inputs: [port('value')],
  outputs: out(),
  fields: [],
})

export const NODE_SCHEMAS: readonly GraphNodeSchema[] = [
  // ── Sources ──────────────────────────────────────────────────────────────
  { type: 'constant', label: 'Constant', category: 'Source', domains: ALL_DOMAINS, description: 'A fixed number.', inputs: [], outputs: out(), fields: [num('value', 1)] },
  {
    type: 'signal',
    label: 'Signal',
    category: 'Source',
    domains: ALL_DOMAINS,
    description: 'Reads a live signal such as audio.bass or pointer.x. In a GPU graph it becomes a uniform updated every frame.',
    inputs: [],
    outputs: out(),
    fields: [{ id: 'id', label: 'Signal', kind: 'signal', default: 'audio.level' }],
  },
  {
    type: 'parameter',
    label: 'Parameter',
    category: 'Source',
    domains: ALL_DOMAINS,
    description: 'Reads a control. In a GPU graph it becomes a uniform updated every frame.',
    inputs: [],
    outputs: out(),
    fields: [{ id: 'id', label: 'Parameter', kind: 'parameter', default: '' }],
  },
  { type: 'time', label: 'Time', category: 'Source', domains: ALL_DOMAINS, description: 'Seconds since the graph started, scaled and offset.', inputs: [], outputs: out(), fields: [num('speed', 1), num('offset', 0)] },
  { type: 'uv', label: 'UV', category: 'GPU', domains: ['gpu'], description: 'Screen or surface UV coordinates as a TSL node.', inputs: [], outputs: out('node'), fields: [] },
  { type: 'uniform', label: 'Uniform', category: 'GPU', domains: ['gpu'], description: 'A writable TSL uniform seeded with a literal.', inputs: [], outputs: out('node'), fields: [num('value', 1)] },

  // ── Math ─────────────────────────────────────────────────────────────────
  { type: 'add', label: 'Add', category: 'Math', domains: ALL_DOMAINS, description: 'Sums every connected input.', inputs: [port('values', 'number', { multiple: true })], outputs: out(), fields: [] },
  { type: 'multiply', label: 'Multiply', category: 'Math', domains: ALL_DOMAINS, description: 'Multiplies every connected input.', inputs: [port('values', 'number', { multiple: true })], outputs: out(), fields: [] },
  { type: 'min', label: 'Min', category: 'Math', domains: ALL_DOMAINS, description: 'Smallest connected input.', inputs: [port('values', 'number', { multiple: true })], outputs: out(), fields: [] },
  { type: 'max', label: 'Max', category: 'Math', domains: ALL_DOMAINS, description: 'Largest connected input.', inputs: [port('values', 'number', { multiple: true })], outputs: out(), fields: [] },
  { type: 'subtract', label: 'Subtract', category: 'Math', domains: ALL_DOMAINS, description: 'A minus B.', inputs: [port('a'), port('b')], outputs: out(), fields: [num('b', 0, { description: 'Used when B is unwired' })] },
  { type: 'divide', label: 'Divide', category: 'Math', domains: ALL_DOMAINS, description: 'A divided by B. Dividing by zero yields A.', inputs: [port('a'), port('b')], outputs: out(), fields: [num('b', 1)] },
  { type: 'modulo', label: 'Modulo', category: 'Math', domains: NUMERIC_DOMAINS, description: 'Remainder of A divided by B.', inputs: [port('a'), port('b')], outputs: out(), fields: [num('b', 1)] },
  { type: 'pow', label: 'Power', category: 'Math', domains: ALL_DOMAINS, description: 'A raised to B.', inputs: [port('a'), port('b')], outputs: out(), fields: [num('power', 2)] },
  unary('abs', 'Absolute', 'Distance from zero.', ALL_DOMAINS),
  unary('negate', 'Negate', 'Flips the sign.'),
  unary('sign', 'Sign', '-1, 0 or 1.'),
  unary('floor', 'Floor', 'Rounds down.'),
  unary('fract', 'Fraction', 'Fractional part, always 0–1.'),
  unary('sqrt', 'Square Root', 'Square root of a non-negative input.'),
  unary('sin', 'Sine', 'Sine of the input in radians.', ALL_DOMAINS),
  unary('cos', 'Cosine', 'Cosine of the input in radians.', ALL_DOMAINS),

  // ── Shaping ──────────────────────────────────────────────────────────────
  { type: 'remap', label: 'Remap', category: 'Shape', domains: ALL_DOMAINS, description: 'Rescales an input range onto an output range.', inputs: [port('value')], outputs: out(), fields: [num('inMin', 0), num('inMax', 1), num('outMin', 0), num('outMax', 1)] },
  { type: 'clamp', label: 'Clamp', category: 'Shape', domains: ALL_DOMAINS, description: 'Holds the input inside a range.', inputs: [port('value')], outputs: out(), fields: [num('min', 0), num('max', 1)] },
  { type: 'smoothstep', label: 'Smoothstep', category: 'Shape', domains: ALL_DOMAINS, description: 'Eased 0–1 ramp between two edges.', inputs: [port('value')], outputs: out(), fields: [num('min', 0), num('max', 1)] },
  { type: 'mix', label: 'Mix', category: 'Shape', domains: ALL_DOMAINS, description: 'Blends A and B by T.', inputs: [port('a'), port('b'), port('t')], outputs: out(), fields: [num('t', 0.5, { min: 0, max: 1 })] },
  { type: 'noise', label: 'Noise', category: 'Shape', domains: NUMERIC_DOMAINS, description: 'Deterministic −1..1 value hashed from the input, or from time when unwired.', inputs: [port('value')], outputs: out(), fields: [num('frequency', 1), num('seed', 0)] },
  {
    type: 'oscillator',
    label: 'Oscillator',
    category: 'Shape',
    domains: NUMERIC_DOMAINS,
    description: 'Free-running waveform. Wire Frequency to modulate its rate.',
    inputs: [port('frequency')],
    outputs: out(),
    fields: [
      { id: 'wave', label: 'Wave', kind: 'select', default: 'sine', options: ['sine', 'triangle', 'saw', 'square'] },
      num('frequency', 1, { min: 0, max: 20 }),
      num('phase', 0, { min: 0, max: 1 }),
      num('amplitude', 1),
      num('offset', 0),
    ],
  },
  { type: 'smooth', label: 'Smooth', category: 'Shape', domains: NUMERIC_DOMAINS, description: 'Frame-rate independent one-pole smoothing. 0 passes through, 1 holds still.', inputs: [port('value')], outputs: out(), fields: [num('amount', 0.85, { min: 0, max: 0.999 })] },

  // ── Logic ────────────────────────────────────────────────────────────────
  {
    type: 'condition',
    label: 'Condition',
    category: 'Logic',
    domains: NUMERIC_DOMAINS,
    description: 'Outputs Yes while Value passes the threshold, otherwise No.',
    inputs: [port('value'), port('yes'), port('no')],
    outputs: out(),
    fields: [{ id: 'comparison', label: 'Comparison', kind: 'select', default: '>', options: ['>', '>=', '<', '<='] }, num('threshold', 0.5), num('yes', 1), num('no', 0)],
  },

  // ── Outputs ──────────────────────────────────────────────────────────────
  {
    type: 'write-parameter',
    label: 'Write Parameter',
    category: 'Output',
    domains: NUMERIC_DOMAINS,
    description: 'Drives a control while the graph runs. The authored value comes back when it stops.',
    inputs: [port('value', 'number', { required: true })],
    outputs: out(),
    fields: [{ id: 'id', label: 'Parameter', kind: 'parameter', default: '' }],
  },
  {
    type: 'write-signal',
    label: 'Write Signal',
    category: 'Output',
    domains: NUMERIC_DOMAINS,
    description: 'Publishes the input as a named signal other graphs and features can read.',
    inputs: [port('value', 'number', { required: true })],
    outputs: out(),
    fields: [{ id: 'id', label: 'Signal', kind: 'text', default: 'graph.out' }],
  },
  { type: 'output', label: 'TSL Output', category: 'GPU', domains: ['gpu'], description: 'Publishes the compiled TSL node, which the Graph effect renders into the chain.', inputs: [port('value', 'node', { required: true })], outputs: [], fields: [] },

  // ── Scene ────────────────────────────────────────────────────────────────
  {
    type: 'scene-object',
    label: 'Scene Object',
    category: 'Scene',
    domains: ['scene'],
    description: 'Resolves a named object in the live scene.',
    inputs: [],
    outputs: [port('object', 'object')],
    fields: [{ id: 'object', label: 'Object', kind: 'scene-object', default: '' }],
  },
  {
    type: 'transform',
    label: 'Transform',
    category: 'Scene',
    domains: ['scene'],
    description: 'Writes position, rotation and scale. Wire any channel to drive it; unwired channels keep their authored value.',
    inputs: [port('object', 'object', { required: true }), port('positionX'), port('positionY'), port('positionZ'), port('rotationX'), port('rotationY'), port('rotationZ'), port('scale')],
    outputs: [port('object', 'object')],
    fields: [
      { id: 'position', label: 'Position', kind: 'vector3', default: [0, 0, 0] },
      { id: 'rotation', label: 'Rotation', kind: 'vector3', default: [0, 0, 0] },
      { id: 'scale', label: 'Scale', kind: 'vector3', default: [1, 1, 1] },
    ],
  },
  {
    type: 'visible',
    label: 'Visibility',
    category: 'Scene',
    domains: ['scene'],
    description: 'Shows or hides the object. A wired number above 0.5 counts as visible.',
    inputs: [port('object', 'object', { required: true }), port('value')],
    outputs: [port('object', 'object')],
    fields: [{ id: 'value', label: 'Visible', kind: 'boolean', default: true }],
  },
  {
    type: 'material-parameter',
    label: 'Material Property',
    category: 'Scene',
    domains: ['scene'],
    description: 'Writes a numeric property on the object material, such as roughness or opacity.',
    inputs: [port('object', 'object', { required: true }), port('value')],
    outputs: [port('object', 'object')],
    fields: [{ id: 'property', label: 'Property', kind: 'text', default: 'roughness' }, num('value', 0.5)],
  },

  // ── Render ───────────────────────────────────────────────────────────────
  {
    type: 'effect-enabled',
    label: 'Effect Enabled',
    category: 'Render',
    domains: ['render'],
    description: 'Switches a PostFX effect in the chain. A wired number above 0.5 enables it.',
    inputs: [port('value')],
    outputs: [],
    fields: [{ id: 'id', label: 'Effect', kind: 'effect', default: '' }, { id: 'enabled', label: 'Enabled', kind: 'boolean', default: true }],
  },
  {
    type: 'effect-order',
    label: 'Effect Order',
    category: 'Render',
    domains: ['render'],
    description: 'Moves a PostFX effect to a position in the chain.',
    inputs: [],
    outputs: [],
    fields: [{ id: 'id', label: 'Effect', kind: 'effect', default: '' }, num('order', 0, { step: 1 })],
  },
  {
    type: 'effect-parameter',
    label: 'Effect Parameter',
    category: 'Render',
    domains: ['render'],
    description: 'Writes one PostFX control. Wire Value to make it audio- or pointer-reactive.',
    inputs: [port('value')],
    outputs: [],
    fields: [{ id: 'id', label: 'Effect', kind: 'effect', default: '' }, { id: 'parameter', label: 'Parameter', kind: 'effect-parameter', default: '' }, num('value', 1)],
  },
]

export const GRAPH_CATEGORIES: readonly GraphCategory[] = ['Source', 'Math', 'Shape', 'Logic', 'Output', 'Scene', 'Render', 'GPU']
export const GRAPH_DOMAINS: readonly GraphDomain[] = ALL_DOMAINS

const BY_TYPE = new Map(NODE_SCHEMAS.map(schema => [schema.type, schema]))
export const schemaFor = (type: string) => BY_TYPE.get(type)
export const schemasForDomain = (domain: GraphDomain) => NODE_SCHEMAS.filter(schema => schema.domains.includes(domain))
export const inputsOf = (node: GraphNode): readonly GraphPort[] => schemaFor(node.type)?.inputs ?? []
export const outputsOf = (node: GraphNode): readonly GraphPort[] => schemaFor(node.type)?.outputs ?? []
export const fieldsOf = (node: GraphNode): readonly GraphField[] => schemaFor(node.type)?.fields ?? []
export const fieldValue = (node: GraphNode, id: string) => node.data?.[id] ?? schemaFor(node.type)?.fields.find(field => field.id === id)?.default
export const labelOf = (node: GraphNode) => node.label ?? schemaFor(node.type)?.label ?? node.type
export const defaultData = (type: string): Record<string, unknown> => Object.fromEntries((schemaFor(type)?.fields ?? []).map(field => [field.id, field.default]))

let sequence = 0
export function createNode(type: string, x = 0, y = 0, data: Record<string, unknown> = {}): GraphNode {
  return { id: `${type}-${(++sequence).toString(36)}${Date.now().toString(36).slice(-4)}`, type, x: Math.round(x), y: Math.round(y), data: { ...defaultData(type), ...data } }
}

/** Edges feeding one input port, in wiring order. */
export const edgesInto = (graph: GraphDefinition, nodeId: string, inputId: string) =>
  graph.edges.filter(edge => edge.to === nodeId && (edge.input ?? 'value') === inputId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

const reaches = (graph: GraphDefinition, from: string, target: string, seen = new Set<string>()): boolean => {
  if (from === target) return true
  if (seen.has(from)) return false
  seen.add(from)
  return graph.edges.filter(edge => edge.from === from).some(edge => reaches(graph, edge.to, target, seen))
}

/** A GPU graph carries TSL nodes on wires the schema describes as numbers. */
const compatible = (from: GraphValueType, to: GraphValueType, domain: GraphDomain) => {
  if (from === to || from === 'any' || to === 'any') return true
  if (domain === 'gpu') return (from === 'number' || from === 'node') && (to === 'number' || to === 'node')
  return false
}

/** Why this connection is refused, or undefined when it is allowed. */
export function connectionError(graph: GraphDefinition, from: GraphNode, outputId: string, to: GraphNode, inputId: string): string | undefined {
  if (from.id === to.id) return 'A node cannot feed itself'
  const output = outputsOf(from).find(item => item.id === outputId)
  const input = inputsOf(to).find(item => item.id === inputId)
  if (!output) return `${from.type} has no output ${outputId}`
  if (!input) return `${to.type} has no input ${inputId}`
  if (!compatible(output.type, input.type, graph.domain)) return `${output.type} does not fit ${input.type}`
  if (graph.edges.some(edge => edge.from === from.id && edge.to === to.id && (edge.output ?? 'value') === outputId && (edge.input ?? 'value') === inputId)) return 'Already connected'
  if (!input.multiple && edgesInto(graph, to.id, inputId).length) return `${input.label ?? input.id} already has a connection`
  if (reaches(graph, to.id, from.id)) return 'That would create a loop'
  return undefined
}

/** Dependency-first node order, plus the nodes left inside a cycle. */
export function topologicalOrder(graph: GraphDefinition): { order: GraphNode[]; cyclic: string[] } {
  const incoming = new Map(graph.nodes.map(node => [node.id, graph.edges.filter(edge => edge.to === node.id && graph.nodes.some(item => item.id === edge.from)).length]))
  const ready = graph.nodes.filter(node => !incoming.get(node.id))
  const order: GraphNode[] = []
  while (ready.length) {
    const node = ready.shift() as GraphNode
    order.push(node)
    for (const edge of graph.edges.filter(item => item.from === node.id)) {
      const remaining = (incoming.get(edge.to) ?? 0) - 1
      incoming.set(edge.to, remaining)
      if (remaining === 0) {
        const next = graph.nodes.find(item => item.id === edge.to)
        if (next) ready.push(next)
      }
    }
  }
  return { order, cyclic: graph.nodes.filter(node => !order.includes(node)).map(node => node.id) }
}

export function validateGraph(graph: GraphDefinition): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = []
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  const supported = new Set(schemasForDomain(graph.domain).map(schema => schema.type))
  for (const node of graph.nodes) {
    const schema = schemaFor(node.type)
    if (!schema) diagnostics.push({ severity: 'error', message: `Unknown node type ${node.type}`, nodeId: node.id })
    else if (!supported.has(node.type)) diagnostics.push({ severity: 'error', message: `${schema.label} is not available in a ${graph.domain} graph`, nodeId: node.id })
  }
  for (const edge of graph.edges) {
    const from = nodes.get(edge.from)
    const to = nodes.get(edge.to)
    if (!from || !to) {
      diagnostics.push({ severity: 'error', message: 'This wire points at a node that is gone', edgeId: edge.id })
      continue
    }
    const output = outputsOf(from).find(item => item.id === (edge.output ?? 'value'))
    const input = inputsOf(to).find(item => item.id === (edge.input ?? 'value'))
    if (!output || !input) {
      diagnostics.push({ severity: 'error', message: 'This wire points at a port that is gone', edgeId: edge.id })
      continue
    }
    if (!compatible(output.type, input.type, graph.domain)) diagnostics.push({ severity: 'error', message: `Incompatible ports: ${output.type} → ${input.type}`, edgeId: edge.id })
  }
  for (const node of graph.nodes) {
    for (const input of inputsOf(node)) {
      const wired = edgesInto(graph, node.id, input.id).length
      if (input.required && !wired) diagnostics.push({ severity: 'error', message: `${labelOf(node)}: ${input.label ?? input.id} must be connected`, nodeId: node.id })
      if (!input.multiple && wired > 1) diagnostics.push({ severity: 'error', message: `${labelOf(node)}: ${input.label ?? input.id} takes one wire but has ${wired}`, nodeId: node.id })
    }
    const needsId = ['signal', 'parameter', 'write-parameter', 'effect-enabled', 'effect-order', 'effect-parameter']
    if (needsId.includes(node.type) && !String(fieldValue(node, 'id') ?? '')) diagnostics.push({ severity: 'warning', message: 'Nothing chosen', nodeId: node.id })
    if (node.type === 'scene-object' && !String(fieldValue(node, 'object') ?? '')) diagnostics.push({ severity: 'warning', message: 'No scene object chosen', nodeId: node.id })
    if (node.type === 'effect-parameter' && !String(fieldValue(node, 'parameter') ?? '')) diagnostics.push({ severity: 'warning', message: 'No effect control chosen', nodeId: node.id })
  }
  for (const id of topologicalOrder(graph).cyclic) diagnostics.push({ severity: 'error', message: 'This node sits in a feedback loop', nodeId: id })
  return diagnostics
}

/** Which controls this graph writes — the host restores them when it stops. */
export const drivenParameters = (graph: GraphDefinition): string[] => [
  ...new Set(
    graph.nodes
      .filter(node => node.type === 'write-parameter' || node.type === 'effect-parameter')
      .map(node => (node.type === 'write-parameter' ? String(fieldValue(node, 'id') ?? '') : `${String(fieldValue(node, 'id') ?? '')}:${String(fieldValue(node, 'parameter') ?? '')}`))
      .filter(id => id && !id.endsWith(':')),
  ),
]

/** Signals this graph reads, so a live view can wire them up. */
export const readSignals = (graph: GraphDefinition): string[] => [...new Set(graph.nodes.filter(node => node.type === 'signal').map(node => String(fieldValue(node, 'id') ?? '')).filter(Boolean))]

const finite = (value: number) => (Number.isFinite(value) ? value : 0)
const hashNoise = (x: number) => {
  const s = Math.sin(x * 12.9898) * 43758.5453123
  return (s - Math.floor(s)) * 2 - 1
}
const vector3 = (value: unknown, fallback: [number, number, number]): [number, number, number] =>
  Array.isArray(value) && value.length >= 3 ? [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0] : fallback

const NUMERIC_TYPES = new Set(NODE_SCHEMAS.filter(schema => schema.category !== 'Scene' && schema.category !== 'Render' && schema.category !== 'GPU').map(schema => schema.type))
export const isNumericNode = (node: GraphNode) => NUMERIC_TYPES.has(node.type)

/**
 * Runs every node once in dependency order and returns each node's output.
 * Numeric nodes are pure; scene, render and output nodes write through the
 * context. Scene nodes pass the object they touched along their `object`
 * output, so a chain of them drives one object.
 */
export function evaluate(graph: GraphDefinition, context: GraphContext): Map<string, unknown> {
  const values = new Map<string, unknown>()
  const numbers = new Map<string, number>()
  const note = (severity: 'error' | 'warning', message: string, nodeId: string) => context.diagnostics?.push({ severity, message, nodeId })

  const wired = (node: GraphNode, portId: string) => edgesInto(graph, node.id, portId).map(edge => numbers.get(edge.from)).filter((value): value is number => value !== undefined)
  /** A wired port wins; otherwise the node's own field is the value. */
  const read = (node: GraphNode, portId: string, fieldId = portId, fallback = 0) => {
    const connected = wired(node, portId)
    if (connected.length) return connected[0]
    const field = fieldValue(node, fieldId)
    return field === undefined ? fallback : finite(Number(field))
  }
  const driven = (node: GraphNode, portId: string) => wired(node, portId)[0]
  const field = (node: GraphNode, id: string, fallback: number) => {
    const value = fieldValue(node, id)
    return value === undefined ? fallback : finite(Number(value))
  }
  const object = (node: GraphNode): GraphObject | undefined => {
    const edge = edgesInto(graph, node.id, 'object')[0]
    if (edge) return values.get(edge.from) as GraphObject | undefined
    const name = String(fieldValue(node, 'object') ?? '')
    return name ? context.findObject?.(name) : undefined
  }

  for (const node of topologicalOrder(graph).order) {
    let output = 0
    let handled = true
    switch (node.type) {
      case 'constant':
        output = field(node, 'value', 0)
        break
      case 'signal':
        output = finite(context.readSignal(String(fieldValue(node, 'id') ?? '')))
        break
      case 'parameter':
        output = finite(context.readParameter(String(fieldValue(node, 'id') ?? '')))
        break
      case 'time':
        output = context.time * field(node, 'speed', 1) + field(node, 'offset', 0)
        break
      case 'add':
        output = wired(node, 'values').reduce((a, b) => a + b, 0)
        break
      case 'multiply': {
        const items = wired(node, 'values')
        output = items.length ? items.reduce((a, b) => a * b, 1) : 0
        break
      }
      case 'min': {
        const items = wired(node, 'values')
        output = items.length ? Math.min(...items) : 0
        break
      }
      case 'max': {
        const items = wired(node, 'values')
        output = items.length ? Math.max(...items) : 0
        break
      }
      case 'subtract':
        output = read(node, 'a') - read(node, 'b')
        break
      case 'divide': {
        const b = read(node, 'b', 'b', 1)
        output = b === 0 ? read(node, 'a') : read(node, 'a') / b
        break
      }
      case 'modulo': {
        const b = read(node, 'b', 'b', 1)
        output = b === 0 ? 0 : read(node, 'a') % b
        break
      }
      case 'pow':
        output = Math.pow(read(node, 'a'), read(node, 'b', 'power', 2))
        break
      case 'abs':
        output = Math.abs(read(node, 'value'))
        break
      case 'negate':
        output = -read(node, 'value')
        break
      case 'sign':
        output = Math.sign(read(node, 'value'))
        break
      case 'floor':
        output = Math.floor(read(node, 'value'))
        break
      case 'fract': {
        const x = read(node, 'value')
        output = x - Math.floor(x)
        break
      }
      case 'sqrt':
        output = Math.sqrt(Math.max(0, read(node, 'value')))
        break
      case 'sin':
        output = Math.sin(read(node, 'value'))
        break
      case 'cos':
        output = Math.cos(read(node, 'value'))
        break
      case 'remap': {
        const x = read(node, 'value')
        const inMin = field(node, 'inMin', 0)
        const outMin = field(node, 'outMin', 0)
        output = outMin + ((x - inMin) / (field(node, 'inMax', 1) - inMin || 1)) * (field(node, 'outMax', 1) - outMin)
        break
      }
      case 'clamp':
        output = Math.max(field(node, 'min', 0), Math.min(field(node, 'max', 1), read(node, 'value')))
        break
      case 'smoothstep': {
        const min = field(node, 'min', 0)
        const t = Math.max(0, Math.min(1, (read(node, 'value') - min) / (field(node, 'max', 1) - min || 1)))
        output = t * t * (3 - 2 * t)
        break
      }
      case 'mix': {
        const t = read(node, 't', 't', 0.5)
        output = read(node, 'a') * (1 - t) + read(node, 'b') * t
        break
      }
      case 'noise': {
        const connected = wired(node, 'value')
        output = hashNoise((connected.length ? connected[0] : context.time) * field(node, 'frequency', 1) + field(node, 'seed', 0))
        break
      }
      case 'oscillator': {
        const frequency = read(node, 'frequency', 'frequency', 1)
        const phase = (context.time * frequency + field(node, 'phase', 0)) % 1
        const wave = String(fieldValue(node, 'wave') ?? 'sine')
        const shape = wave === 'saw' ? phase * 2 - 1 : wave === 'square' ? (phase < 0.5 ? 1 : -1) : wave === 'triangle' ? 1 - Math.abs(phase * 4 - 2) : Math.sin(phase * Math.PI * 2)
        output = shape * field(node, 'amplitude', 1) + field(node, 'offset', 0)
        break
      }
      case 'smooth': {
        const target = read(node, 'value')
        const amount = Math.max(0, Math.min(0.999, field(node, 'amount', 0.85)))
        const previous = context.memory.get(node.id)
        // Exponential decay against real elapsed time, so the feel does not change with frame rate.
        const alpha = amount <= 0 ? 1 : 1 - Math.pow(amount, Math.max(context.delta, 1 / 240) * 60)
        output = previous === undefined ? target : previous + (target - previous) * alpha
        context.memory.set(node.id, output)
        break
      }
      case 'condition': {
        const value = read(node, 'value')
        const threshold = field(node, 'threshold', 0.5)
        const comparison = String(fieldValue(node, 'comparison') ?? '>')
        const passes = comparison === '>=' ? value >= threshold : comparison === '<' ? value < threshold : comparison === '<=' ? value <= threshold : value > threshold
        output = passes ? read(node, 'yes', 'yes', 1) : read(node, 'no', 'no', 0)
        break
      }
      case 'write-parameter': {
        output = read(node, 'value')
        const id = String(fieldValue(node, 'id') ?? '')
        // An unwired output writes nothing: a half-built node must not clobber a control.
        if (id && edgesInto(graph, node.id, 'value').length) context.writeParameter(id, output)
        break
      }
      case 'write-signal': {
        output = read(node, 'value')
        const id = String(fieldValue(node, 'id') ?? '')
        if (id && edgesInto(graph, node.id, 'value').length) context.writeSignal(id, output)
        break
      }

      // ── Scene ────────────────────────────────────────────────────────────
      case 'scene-object': {
        const name = String(fieldValue(node, 'object') ?? '')
        const found = name ? context.findObject?.(name) : undefined
        if (!found) note('warning', `Scene object “${name || '—'}” was not found`, node.id)
        else values.set(node.id, found)
        handled = false
        break
      }
      case 'transform':
      case 'visible':
      case 'material-parameter': {
        handled = false
        const target = object(node)
        if (!target) {
          note('warning', 'No scene object is connected', node.id)
          break
        }
        if (node.type === 'transform') {
          const position = vector3(fieldValue(node, 'position'), [0, 0, 0])
          const rotation = vector3(fieldValue(node, 'rotation'), [0, 0, 0])
          const scale = vector3(fieldValue(node, 'scale'), [1, 1, 1])
          target.position.set(driven(node, 'positionX') ?? position[0], driven(node, 'positionY') ?? position[1], driven(node, 'positionZ') ?? position[2])
          target.rotation.set(driven(node, 'rotationX') ?? rotation[0], driven(node, 'rotationY') ?? rotation[1], driven(node, 'rotationZ') ?? rotation[2])
          const uniform = driven(node, 'scale')
          target.scale.set(uniform ?? scale[0], uniform ?? scale[1], uniform ?? scale[2])
        } else if (node.type === 'visible') {
          const connected = driven(node, 'value')
          target.visible = connected === undefined ? Boolean(fieldValue(node, 'value')) : connected > 0.5
        } else {
          const property = String(fieldValue(node, 'property') ?? '')
          const problem = context.writeMaterial?.(target, property, driven(node, 'value') ?? field(node, 'value', 0))
          if (problem) note('warning', problem, node.id)
        }
        values.set(node.id, target)
        break
      }

      // ── Render ───────────────────────────────────────────────────────────
      case 'effect-enabled':
      case 'effect-order':
      case 'effect-parameter': {
        handled = false
        const id = String(fieldValue(node, 'id') ?? '')
        if (!id) break
        if (context.hasEffect && !context.hasEffect(id)) {
          note('warning', `Effect “${id}” is not in the chain`, node.id)
          break
        }
        if (node.type === 'effect-enabled') {
          const connected = driven(node, 'value')
          const enabled = connected === undefined ? Boolean(fieldValue(node, 'enabled')) : connected > 0.5
          context.setEffectEnabled?.(id, enabled)
          values.set(node.id, enabled)
        } else if (node.type === 'effect-order') {
          const order = field(node, 'order', 0)
          context.setEffectOrder?.(id, order)
          values.set(node.id, order)
        } else {
          const parameter = String(fieldValue(node, 'parameter') ?? '')
          if (!parameter) break
          const next = driven(node, 'value') ?? field(node, 'value', 0)
          context.setEffectParameter?.(id, parameter, next)
          values.set(node.id, next)
          numbers.set(node.id, next)
        }
        break
      }

      default:
        handled = false
        break
    }
    if (handled) {
      numbers.set(node.id, finite(output))
      values.set(node.id, finite(output))
    }
  }
  return values
}

/** The numbers out of an evaluation, for readouts and previews. */
export const numericValues = (values: Map<string, unknown>) => {
  const numbers = new Map<string, number>()
  for (const [id, value] of values) if (typeof value === 'number') numbers.set(id, value)
  return numbers
}
