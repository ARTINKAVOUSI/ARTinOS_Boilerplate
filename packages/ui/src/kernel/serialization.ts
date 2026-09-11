export interface ComponentTreeNode {
  component: string
  parameter?: string
  presentation?: string
  state?: Record<string, string | number | boolean | null>
  props?: Record<string, unknown>
  layout?: Record<string, unknown>
  children?: ComponentTreeNode[]
}

export interface SerializedComponentNode extends ComponentTreeNode {
  version: 1
  children?: SerializedComponentNode[]
}

export interface ComponentRegistryLookup {
  has(id: string): boolean
}

export interface ComponentTreeIssue {
  path: string
  message: string
}

export interface ComponentTreeValidation {
  valid: boolean
  errors: ComponentTreeIssue[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isDomLike = (value: Record<string, unknown>): boolean =>
  typeof value.nodeType === 'number' && typeof value.nodeName === 'string'

function cloneSemantic(value: unknown, path: string, ancestors: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'undefined') return undefined
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new Error(`Non-serializable value at ${path}`)
  }
  if (typeof value !== 'object') throw new Error(`Unsupported value at ${path}`)
  if (isDomLike(value as Record<string, unknown>)) throw new Error(`DOM value is not allowed at ${path}`)
  if (ancestors.has(value)) throw new Error(`Cyclic component data at ${path}`)
  ancestors.add(value)
  let result: unknown
  if (Array.isArray(value)) {
    result = value.map((entry, index) => cloneSemantic(entry, `${path}[${index}]`, ancestors))
  } else {
    const record: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      const cloned = cloneSemantic(entry, `${path}.${key}`, ancestors)
      if (cloned !== undefined) record[key] = cloned
    }
    result = record
  }
  ancestors.delete(value)
  return result
}

export function validateComponentTree(
  node: ComponentTreeNode,
  registry?: ComponentRegistryLookup,
): ComponentTreeValidation {
  const errors: ComponentTreeIssue[] = []
  const active = new Set<object>()
  const visit = (current: ComponentTreeNode, path: string) => {
    if (!isRecord(current)) { errors.push({ path, message: 'Component node must be an object' }); return }
    if (active.has(current)) { errors.push({ path, message: 'Component tree contains a cycle' }); return }
    active.add(current)
    if (typeof current.component !== 'string' || !current.component.trim()) errors.push({ path: `${path}.component`, message: 'Component id is required' })
    else if (registry && !registry.has(current.component)) errors.push({ path: `${path}.component`, message: `Unknown component: ${current.component}` })
    for (const field of ['props', 'layout', 'state'] as const) {
      if (current[field] !== undefined) {
        try { cloneSemantic(current[field], `${path}.${field}`, new Set()) }
        catch (error) { errors.push({ path: `${path}.${field}`, message: error instanceof Error ? error.message : String(error) }) }
      }
    }
    if (current.children !== undefined && !Array.isArray(current.children)) errors.push({ path: `${path}.children`, message: 'Children must be an array' })
    else current.children?.forEach((child, index) => visit(child, `${path}.children[${index}]`))
    active.delete(current)
  }
  visit(node, '$')
  return { valid: errors.length === 0, errors }
}

export function serializeComponent(
  node: ComponentTreeNode,
  registry?: ComponentRegistryLookup,
): SerializedComponentNode {
  const validation = validateComponentTree(node, registry)
  if (!validation.valid) throw new Error(validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n'))
  const serializeNode = (current: ComponentTreeNode, path: string): SerializedComponentNode => ({
    version: 1,
    component: current.component,
    parameter: current.parameter,
    presentation: current.presentation,
    state: cloneSemantic(current.state, `${path}.state`, new Set()) as SerializedComponentNode['state'],
    props: cloneSemantic(current.props, `${path}.props`, new Set()) as Record<string, unknown> | undefined,
    layout: cloneSemantic(current.layout, `${path}.layout`, new Set()) as Record<string, unknown> | undefined,
    children: current.children?.map((child, index) => serializeNode(child, `${path}.children[${index}]`)),
  })
  return serializeNode(node, '$')
}

export function deserializeComponent(
  data: unknown,
  registry?: ComponentRegistryLookup,
): ComponentTreeNode {
  if (!isRecord(data) || data.version !== 1) throw new Error('Unsupported serialized component version')
  const node = cloneSemantic(data, '$', new Set()) as SerializedComponentNode
  const validation = validateComponentTree(node, registry)
  if (!validation.valid) throw new Error(validation.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n'))
  const stripVersion = (current: SerializedComponentNode): ComponentTreeNode => ({
    component: current.component,
    parameter: current.parameter,
    presentation: current.presentation,
    state: current.state,
    props: current.props,
    layout: current.layout,
    children: current.children?.map(stripVersion),
  })
  return stripVersion(node)
}

export function walkComponentTree(
  node: ComponentTreeNode,
  visitor: (node: ComponentTreeNode, path: string, parent?: ComponentTreeNode) => void,
): void {
  const active = new Set<ComponentTreeNode>()
  const walk = (current: ComponentTreeNode, path: string, parent?: ComponentTreeNode) => {
    if (active.has(current)) throw new Error(`Cyclic component tree at ${path}`)
    active.add(current)
    visitor(current, path, parent)
    current.children?.forEach((child, index) => walk(child, `${path}.children[${index}]`, current))
    active.delete(current)
  }
  walk(node, '$')
}
