/**
 * GPU graphs compile to real TSL nodes.
 *
 * Compilation happens when the definition changes, never per frame: rebuilding
 * a node graph every frame forces a pipeline recompile and stalls the renderer.
 * Live values ride on uniforms instead — `refresh` pushes the current signal and
 * parameter values into the uniforms the compile created.
 */
import * as TSL from 'three/tsl'
import { edgesInto, fieldValue, topologicalOrder, type GraphDefinition, type GraphDiagnostic, type GraphHost, type GraphNode } from './graph'

// TSL's exports are factory functions with loose typing by design.
const api = TSL as unknown as Record<string, (...args: never[]) => TSLNode>
type TSLNode = {
  add(other: unknown): TSLNode
  mul(other: unknown): TSLNode
  min(other: unknown): TSLNode
  max(other: unknown): TSLNode
  sub(other: unknown): TSLNode
  div(other: unknown): TSLNode
  pow(other: unknown): TSLNode
  value?: number
}

export interface UniformBinding {
  uniform: { value: number }
  kind: 'signal' | 'parameter'
  id: string
}

export interface CompiledGraph {
  /** The node the TSL Output publishes, or null when the graph has no output. */
  node: TSLNode | null
  uniforms: UniformBinding[]
  /** Every node's compiled value, for previews. */
  values: Map<string, TSLNode>
  diagnostics: GraphDiagnostic[]
}

const float = (value: number) => api.float(value as never)

export function compileGPU(graph: GraphDefinition, host: Pick<GraphHost, 'readSignal' | 'readParameter'>): CompiledGraph {
  const values = new Map<string, TSLNode>()
  const uniforms: UniformBinding[] = []
  const diagnostics: GraphDiagnostic[] = []
  let output: TSLNode | null = null

  const port = (node: GraphNode, portId: string) => {
    const edge = edgesInto(graph, node.id, portId)[0]
    return edge ? values.get(edge.from) : undefined
  }
  const many = (node: GraphNode, portId: string) => edgesInto(graph, node.id, portId).map(edge => values.get(edge.from)).filter((value): value is TSLNode => !!value)
  const literal = (node: GraphNode, id: string, fallback: number) => {
    const value = fieldValue(node, id)
    return value === undefined ? fallback : Number(value) || 0
  }
  /** A wired port wins; otherwise the field becomes a constant node. */
  const operand = (node: GraphNode, portId: string, fieldId: string, fallback: number) => port(node, portId) ?? float(literal(node, fieldId, fallback))
  const reduce = (node: GraphNode, method: 'add' | 'mul' | 'min' | 'max', identity: number) => {
    const items = many(node, 'values')
    if (!items.length) return float(identity)
    return items.slice(1).reduce((carry, item) => carry[method](item), items[0])
  }

  for (const node of topologicalOrder(graph).order) {
    let value: TSLNode | undefined
    switch (node.type) {
      case 'constant':
        value = float(literal(node, 'value', 0))
        break
      case 'uniform':
        value = api.uniform(literal(node, 'value', 1) as never)
        break
      case 'signal':
      case 'parameter': {
        const id = String(fieldValue(node, 'id') ?? '')
        const seed = node.type === 'signal' ? host.readSignal(id) : host.readParameter(id)
        const uniform = api.uniform((Number.isFinite(seed) ? seed : 0) as never) as TSLNode & { value: number }
        if (id) uniforms.push({ uniform, kind: node.type, id })
        else diagnostics.push({ severity: 'warning', message: `No ${node.type} chosen`, nodeId: node.id })
        value = uniform
        break
      }
      case 'time':
        value = (TSL as unknown as { time: TSLNode }).time
        break
      case 'uv':
        value = api.uv()
        break
      case 'add':
        value = reduce(node, 'add', 0)
        break
      case 'multiply':
        value = reduce(node, 'mul', 1)
        break
      case 'min':
        value = reduce(node, 'min', 0)
        break
      case 'max':
        value = reduce(node, 'max', 0)
        break
      case 'subtract':
        value = operand(node, 'a', 'a', 0).sub(operand(node, 'b', 'b', 0))
        break
      case 'divide':
        value = operand(node, 'a', 'a', 0).div(operand(node, 'b', 'b', 1))
        break
      case 'pow':
        value = operand(node, 'a', 'a', 0).pow(operand(node, 'b', 'power', 2))
        break
      case 'abs':
        value = api.abs(operand(node, 'value', 'value', 0) as never)
        break
      case 'sin':
        value = api.sin(operand(node, 'value', 'value', 0) as never)
        break
      case 'cos':
        value = api.cos(operand(node, 'value', 'value', 0) as never)
        break
      case 'clamp':
        value = api.clamp(operand(node, 'value', 'value', 0) as never, literal(node, 'min', 0) as never, literal(node, 'max', 1) as never)
        break
      case 'smoothstep':
        value = api.smoothstep(literal(node, 'min', 0) as never, literal(node, 'max', 1) as never, operand(node, 'value', 'value', 0) as never)
        break
      case 'mix':
        value = api.mix(operand(node, 'a', 'a', 0) as never, operand(node, 'b', 'b', 1) as never, operand(node, 't', 't', 0.5) as never)
        break
      case 'remap':
        value = api.remap(
          operand(node, 'value', 'value', 0) as never,
          literal(node, 'inMin', 0) as never,
          literal(node, 'inMax', 1) as never,
          literal(node, 'outMin', 0) as never,
          literal(node, 'outMax', 1) as never,
        )
        break
      case 'output': {
        const source = port(node, 'value')
        if (!source) {
          diagnostics.push({ severity: 'error', message: 'TSL Output has nothing connected', nodeId: node.id })
          continue
        }
        value = source
        output = source
        break
      }
      default:
        diagnostics.push({ severity: 'error', message: `A GPU graph cannot use ${node.type}`, nodeId: node.id })
        continue
    }
    if (!value) {
      diagnostics.push({ severity: 'error', message: 'This node has no resolvable input', nodeId: node.id })
      continue
    }
    values.set(node.id, value)
  }

  return { node: output, uniforms, values, diagnostics }
}

/** Push the current live values into a compiled graph's uniforms. */
export function refreshUniforms(uniforms: readonly UniformBinding[], host: Pick<GraphHost, 'readSignal' | 'readParameter'>) {
  for (const binding of uniforms) {
    const next = binding.kind === 'signal' ? host.readSignal(binding.id) : host.readParameter(binding.id)
    if (Number.isFinite(next)) binding.uniform.value = next
  }
}
