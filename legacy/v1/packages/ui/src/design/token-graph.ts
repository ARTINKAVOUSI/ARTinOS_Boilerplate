export type TokenLayer = 'primitive' | 'semantic' | 'component' | 'state' | 'context'
export type TokenExpression = string | number | { ref: string }

export interface TokenNode {
  id: string
  layer: TokenLayer
  value: TokenExpression
  description?: string
  cssVariable?: string
  overrides?: Record<string, TokenExpression>
  metadata?: Record<string, unknown>
}

export interface ResolvedToken {
  id: string
  layer: TokenLayer
  value: string | number
  cssVariable: string
  references: string[]
}

export interface TokenGraphIssue {
  id: string
  message: string
}

const LAYER_ORDER: Record<TokenLayer, number> = {
  primitive: 0,
  semantic: 1,
  component: 2,
  state: 3,
  context: 4,
}

export const tokenRef = (id: string): TokenExpression => ({ ref: id })
export const tokenVariableName = (id: string): string => `--artinos-${id.replace(/[^a-zA-Z0-9_-]+/g, '-')}`

export class TokenGraph {
  private nodes = new Map<string, TokenNode>()

  register(node: TokenNode): () => void {
    if (!node.id.trim()) throw new Error('Token id is required')
    const previous = this.nodes.get(node.id)
    const normalized: TokenNode = {
      ...node,
      cssVariable: node.cssVariable ?? tokenVariableName(node.id),
      overrides: node.overrides ? { ...node.overrides } : undefined,
      metadata: node.metadata ? { ...node.metadata } : undefined,
    }
    this.nodes.set(node.id, normalized)
    return () => {
      if (this.nodes.get(node.id) !== normalized) return
      if (previous) this.nodes.set(previous.id, previous)
      else this.nodes.delete(node.id)
    }
  }

  get(id: string): TokenNode | undefined { return this.nodes.get(id) }
  require(id: string): TokenNode {
    const node = this.get(id)
    if (!node) throw new Error(`Unknown token: ${id}`)
    return node
  }
  has(id: string): boolean { return this.nodes.has(id) }
  list(layer?: TokenLayer): TokenNode[] {
    const nodes = [...this.nodes.values()]
    return layer ? nodes.filter(node => node.layer === layer) : nodes
  }
  cssVariable(id: string): string { return this.require(id).cssVariable as string }
  cssReference(id: string): string { return `var(${this.cssVariable(id)})` }

  resolve(id: string, contexts: string[] = []): ResolvedToken {
    const references: string[] = []
    const active = new Set<string>()
    const resolveExpression = (owner: TokenNode, expression: TokenExpression): string | number => {
      if (typeof expression !== 'object') return expression
      if (active.has(expression.ref)) throw new Error(`Cyclic token reference: ${[...active, expression.ref].join(' -> ')}`)
      const target = this.require(expression.ref)
      if (LAYER_ORDER[target.layer] > LAYER_ORDER[owner.layer]) {
        throw new Error(`Token ${owner.id} cannot depend on later layer ${target.id}`)
      }
      references.push(target.id)
      active.add(target.id)
      const contextual = [...contexts].reverse().map(context => target.overrides?.[context]).find(value => value !== undefined)
      const value = resolveExpression(target, contextual ?? target.value)
      active.delete(target.id)
      return value
    }
    const node = this.require(id)
    active.add(id)
    const contextual = [...contexts].reverse().map(context => node.overrides?.[context]).find(value => value !== undefined)
    const value = resolveExpression(node, contextual ?? node.value)
    return { id, layer: node.layer, value, cssVariable: node.cssVariable as string, references }
  }

  validate(): TokenGraphIssue[] {
    const issues: TokenGraphIssue[] = []
    for (const node of this.nodes.values()) {
      try { this.resolve(node.id, Object.keys(node.overrides ?? {})) }
      catch (error) { issues.push({ id: node.id, message: error instanceof Error ? error.message : String(error) }) }
    }
    return issues
  }

  manifest(): { version: 1; tokens: Array<TokenNode & { resolved: string | number }> } {
    return {
      version: 1,
      tokens: this.list().map(node => ({ ...node, resolved: this.resolve(node.id).value })),
    }
  }

  emitCSS(rootSelector = ':root'): string {
    const base = this.list().map(node => `  ${node.cssVariable}: ${this.expressionCSS(node.value)};`).join('\n')
    const contexts = new Set(this.list().flatMap(node => Object.keys(node.overrides ?? {})))
    const blocks = [...contexts].sort().map(context => {
      const values = this.list()
        .filter(node => node.overrides?.[context] !== undefined)
        .map(node => `  ${node.cssVariable}: ${this.expressionCSS(node.overrides?.[context] as TokenExpression)};`)
        .join('\n')
      return `[data-context~="${context}"] {\n${values}\n}`
    })
    return `${rootSelector} {\n${base}\n}\n${blocks.join('\n')}`
  }

  private expressionCSS(expression: TokenExpression): string {
    return typeof expression === 'object' ? this.cssReference(expression.ref) : String(expression)
  }
}

export function createArtinosTokenGraph(): TokenGraph {
  const graph = new TokenGraph()
  const add = (id: string, layer: TokenLayer, value: TokenExpression, cssVariable?: string, overrides?: Record<string, TokenExpression>) =>
    graph.register({ id, layer, value, cssVariable, overrides })

  add('primitive.color.ink.void', 'primitive', '#090909', '--ink-void')
  add('primitive.color.ink.stage', 'primitive', '#0e0e0e', '--ink-stage')
  add('primitive.color.ink.surface', 'primitive', '#141414', '--ink-surface')
  add('primitive.color.ink.raised', 'primitive', '#191919', '--ink-raised')
  add('primitive.color.text.high', 'primitive', '#f4f4f4', '--chalk-hi')
  add('primitive.color.text.mid', 'primitive', '#bfbfbf', '--chalk-mid')
  add('primitive.color.text.low', 'primitive', '#919191', '--chalk-low')
  add('primitive.color.signal.live', 'primitive', '#2fb39c', '--teal-500')
  add('primitive.color.signal.warn', 'primitive', '#e0a34e', '--amber-500')
  add('primitive.color.signal.fault', 'primitive', '#f2606f', '--rose-500')
  add('primitive.color.signal.bind', 'primitive', '#8fb8d9', '--azure-500')
  ;[2, 4, 6, 8, 12, 16, 24, 32].forEach((value, index) => add(`primitive.space.${index + 1}`, 'primitive', `${value}px`, `--space-${index + 1}`))
  ;[5, 8, 12, 16].forEach((value, index) => add(`primitive.radius.${index + 1}`, 'primitive', `${value}px`))
  add('primitive.blur.1', 'primitive', 'blur(36px) saturate(128%)')
  add('primitive.blur.2', 'primitive', 'blur(44px) saturate(135%)')
  add('primitive.motion.fast', 'primitive', '70ms')
  add('primitive.motion.state', 'primitive', '130ms')
  add('primitive.motion.surface', 'primitive', '220ms')
  add('primitive.motion.layout', 'primitive', '380ms')
  add('primitive.spring.precise', 'primitive', '420 40 1')
  add('primitive.spring.soft', 'primitive', '180 26 1')

  add('surface.canvas', 'semantic', tokenRef('primitive.color.ink.void'), '--bg-app')
  add('surface.stage', 'semantic', tokenRef('primitive.color.ink.stage'), '--bg-stage')
  add('surface.panel', 'semantic', tokenRef('primitive.color.ink.surface'), '--bg-surface')
  add('surface.raised', 'semantic', tokenRef('primitive.color.ink.raised'), '--bg-raised')
  add('text.primary', 'semantic', tokenRef('primitive.color.text.high'), '--text-hi')
  add('text.secondary', 'semantic', tokenRef('primitive.color.text.mid'), '--text-mid')
  add('text.muted', 'semantic', tokenRef('primitive.color.text.low'), '--text-low')
  add('signal.live', 'semantic', tokenRef('primitive.color.signal.live'), '--sig-live')
  add('signal.warning', 'semantic', tokenRef('primitive.color.signal.warn'), '--sig-warn')
  add('signal.fault', 'semantic', tokenRef('primitive.color.signal.fault'), '--sig-fault')
  add('signal.binding', 'semantic', tokenRef('primitive.color.signal.bind'), '--sig-bind')
  add('focus.ring', 'semantic', '0 0 0 1px var(--sig-live)', '--focus-ring')
  add('selection.surface', 'semantic', 'color-mix(in srgb,var(--sig-live) 16%,transparent)', '--selection-surface')
  add('layer.panel', 'semantic', 30, '--layer-panel')
  add('layer.overlay', 'semantic', 60, '--layer-overlay')
  add('layer.modal', 'semantic', 100, '--layer-modal')

  add('slider.rail.height', 'component', '2px', '--slider-rail-height')
  add('slider.thumb.size', 'component', '12px', '--slider-thumb-size', { touch: '20px', compact: '10px' })
  add('slider.active.surface', 'state', tokenRef('selection.surface'), '--slider-active-surface')
  add('panel.blur', 'component', tokenRef('primitive.blur.2'), '--panel-blur', { minimal: 'none' })
  add('propertyRow.height', 'component', '28px', '--property-row-height', { compact: '24px', touch: '44px' })
  add('context.control.height', 'context', '28px', '--context-control-height', { compact: '24px', touch: '44px' })
  return graph
}

export const tokenGraph = createArtinosTokenGraph()
