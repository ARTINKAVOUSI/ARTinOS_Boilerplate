import type { ArtinosRuntime } from '@artinos/runtime'
import type { SceneObjectLike } from '../adapters/scene-schema'
import { sceneObjectBindings } from '../adapters/scene-schema'
import { controls } from '@artinos/ui'
import { TOKEN_GRAPH } from '@artinos/ui'
import type { ComponentDefinition, ComponentTreeNode, PresentationContext } from '@artinos/ui'

export interface UIQueryContext { runtime?: ArtinosRuntime }

/** Structured, read-mostly facade used by docs, agents, DevTools and generators. */
export class UIQueryAPI {
  constructor(private context: UIQueryContext = {}) {}
  components(query: Parameters<typeof controls.query>[0] = {}): ComponentDefinition[] { return controls.query(query) }
  inspectorParameters(prefix?: string) { return (this.context.runtime?.parameters.list() ?? []).filter(state => !prefix || state.definition.id.startsWith(prefix)).map(state => ({ ...state.definition, value: state.baseValue, resolvedValue: state.resolvedValue, source: state.resolvedSource })) }
  controlsFor(parameterKind: string, context: PresentationContext = 'inspector') { return controls.presentationsFor(parameterKind, { context }) }
  surfaceTokens() { return TOKEN_GRAPH.manifest().tokens.filter(token => /surface|bg|border|shadow|material/.test(token.id)) }
  ownerOfState(state: string) { return controls.list().filter(component => Object.keys(component.state.initial).includes(state) || component.state.states?.includes(state)) }
  animatedParameters() { const runtime = this.context.runtime; return runtime ? runtime.automation.list().map(track => ({ track, parameter: runtime.parameters.state(track.target)?.definition })) : [] }
  inspectorFor(object: SceneObjectLike) { return sceneObjectBindings(object).map(binding => binding.definition) }
  replacePresentations(tree: ComponentTreeNode, from: string[], to: string): ComponentTreeNode {
    return { ...tree, presentation: tree.presentation && from.includes(tree.presentation) ? to : tree.presentation, children: tree.children?.map(child => this.replacePresentations(child, from, to)) }
  }
  compactToolbar(parameterIds: string[]): ComponentTreeNode {
    const runtime = this.context.runtime
    return { component: 'toolbar', props: { density: 'compact' }, children: parameterIds.flatMap(id => { const definition = runtime?.parameters.state(id)?.definition; if (!definition) return []; const presentation = controls.resolve({ type: definition.type, context: 'toolbar', density: 'compact' }); return [{ component: presentation?.component ?? 'unsupported-control', parameter: id, presentation: presentation?.id, props: { label: definition.label ?? id } }] }) }
  }
}

export const createUIQueryAPI = (context?: UIQueryContext) => new UIQueryAPI(context)
