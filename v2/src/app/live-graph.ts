/**
 * The live graph: what is actually running on the page, read back as nodes.
 *
 * A port of the original studio's live view. Nothing here is authored — every
 * node and wire is derived from the registry, the studio state, the signal bus
 * and the graph documents on the frame it is built: the live signals being
 * produced, the graphs consuming them, the controls they drive, the objects in
 * the viewport and the render pipeline that draws them.
 */
import { features } from './registry'
import { studio } from './store'
import { graphs, parameterId } from './graphs'
import { runtime } from './runtime'
import { signalBus } from '../features/input/signals'
import { pipelineStages } from './pipeline-stages'
import { drivenParameters, fieldValue } from '../ui/NodeGraph/graph'
import { LIVE_COLUMN_STEP, measureLiveNode, type LiveControl, type LiveEdge, type LiveGraph, type LiveNode } from '../ui/NodeGraph/LiveGraphView'

export const LIVE_COLUMNS = ['Input', 'Logic', 'Parameters', 'Scene', 'Render']
const ROW_GAP = 18
const SIGNAL_LIMIT = 14
const SCENE_LIMIT = 14
/** A signal written within this window counts as moving. */
const MOVING_MS = 600

// The objects the scene column shows, by node id, for the inspector and controls.
const liveObjects = new Map<string, Record<string, unknown>>()
export const liveObject = (nodeId: string) => liveObjects.get(nodeId)
const short = (value: number) => (Number.isFinite(value) ? (Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(3)) : '—')

/** Which MRT attachment an effect asks the pipeline for — the same list the host uses. */
const NEEDS: Record<string, readonly string[]> = {
  'effect.ssao': ['normal', 'depth'],
  'effect.ssgi': ['normal', 'depth'],
  'effect.ssr': ['normal', 'depth', 'metalRoughness'],
  'effect.motion-blur': ['velocity'],
  'effect.traa': ['velocity'],
  'effect.taau': ['velocity', 'depth'],
  'effect.depth-of-field': ['depth'],
  'effect.god-rays': ['depth'],
  'effect.screen-space-shadows': ['depth', 'normal'],
  'effect.subsurface': ['depth'],
  'effect.denoise': ['normal', 'depth'],
  'effect.recurrent-denoise': ['normal', 'depth', 'velocity'],
}

/** What a live node stands for, so the inspector can edit it rather than describe it. */
export type LiveTarget =
  | { kind: 'signal'; id: string }
  | { kind: 'parameter'; id: string }
  | { kind: 'feature'; id: string }
  | { kind: 'effect'; id: string }
  | { kind: 'object'; name: string }
  | { kind: 'graph'; id: string }
  | { kind: 'pass'; id: string }

const targets = new Map<string, LiveTarget>()
/** What the node with this id stands for, for the Live inspector. */
export const liveTarget = (nodeId: string) => targets.get(nodeId)

/** Every control a feature declares, bound to the studio store. */
function controlsOf(featureId: string, values: Record<string, unknown>, controls: Record<string, { type: string; value: unknown; min?: number; max?: number; step?: number; label?: string }> | undefined): LiveControl[] {
  const list: LiveControl[] = []
  for (const [name, control] of Object.entries(controls ?? {})) {
    const id = parameterId(featureId, name)
    const label = control.label ?? name
    const value = values[name] ?? control.value
    if (control.type === 'number' && typeof value === 'number') {
      list.push({ kind: 'number', id, label, value, min: control.min ?? 0, max: control.max ?? Math.max(1, Math.abs(value) * 3), step: control.step ?? 0.01 })
    } else if (control.type === 'boolean') {
      list.push({ kind: 'boolean', id, label, value: Boolean(value) })
    } else {
      list.push({ kind: 'readout', id, label, value: Array.isArray(value) ? value.map(item => Number(item).toFixed(2)).join(', ') : String(value) })
    }
  }
  return list
}

export function buildLiveGraph(): LiveGraph {
  const state = studio.getState()
  const documents = graphs.getState().documents
  const nodes: LiveNode[] = []
  const edges: LiveEdge[] = []
  const cursor = [0, 0, 0, 0, 0]
  targets.clear()

  const place = (node: Omit<LiveNode, 'x' | 'y' | 'height' | 'controls' | 'preview'> & { controls?: LiveControl[]; preview?: 'value' | 'render' | 'none'; target?: LiveTarget }) => {
    const controls = node.controls ?? []
    const preview = node.preview ?? 'none'
    const placed: LiveNode = { ...node, controls, preview, height: measureLiveNode(controls, preview), x: node.column * LIVE_COLUMN_STEP, y: cursor[node.column] }
    cursor[node.column] += placed.height + ROW_GAP
    nodes.push(placed)
    if (node.target) targets.set(placed.id, node.target)
    return placed
  }
  const has = (id: string) => nodes.some(node => node.id === id)
  const link = (from: string, to: string) => {
    const id = `${from}->${to}`
    if (!has(from) || !has(to) || edges.some(edge => edge.id === id)) return
    edges.push({ id, from, to })
  }
  const on = (id: string) => !!state.features[id]?.enabled
  const values = (id: string) => state.features[id]?.values ?? {}
  const running = documents.filter(document => document.running)

  // ── Input: the signals actually consumed, plus anything currently moving ─
  const consumed = new Set(running.flatMap(document => document.graph.nodes.filter(node => node.type === 'signal').map(node => String(fieldValue(node, 'id') ?? ''))))
  const moving = signalBus.entries().filter(([name]) => signalBus.age(name) < MOVING_MS).map(([name]) => name)
  const signalIds = [...new Set([...consumed, ...moving])].filter(Boolean).sort().slice(0, SIGNAL_LIMIT)
  for (const id of signalIds) {
    const value = signalBus.get(id)
    place({
      id: `signal:${id}`,
      kind: 'signal',
      title: id,
      subtitle: 'signal',
      value: short(value),
      column: 0,
      muted: !consumed.has(id),
      preview: 'value',
      target: { kind: 'signal', id },
    })
  }

  // ── Logic: the graphs that read signals and write parameters ────────────
  for (const document of documents) {
    place({
      id: `graph:${document.id}`,
      kind: 'graph',
      title: document.name,
      subtitle: `${document.domain} graph`,
      detail: `${document.graph.nodes.length} nodes`,
      column: 1,
      muted: !document.running,
      target: { kind: 'graph', id: document.id },
      controls: [{ kind: 'boolean', id: 'running', label: 'evaluate', value: document.running }],
    })
    for (const node of document.graph.nodes) if (node.type === 'signal') link(`signal:${String(fieldValue(node, 'id') ?? '')}`, `graph:${document.id}`)
  }

  // ── Parameters that are actually driven ─────────────────────────────────
  const driven = [...new Set(running.flatMap(document => drivenParameters(document.graph)))]
  for (const id of driven) {
    const [featureId, name] = id.split(':')
    const feature = features.find(item => item.id === featureId)
    const control = feature?.controls?.[name]
    if (!feature || !control) continue
    const value = values(featureId)[name] ?? control.value
    const number = typeof value === 'number' ? value : null
    place({
      id: `parameter:${id}`,
      kind: 'parameter',
      title: id,
      subtitle: 'parameter',
      detail: feature.label,
      value: number !== null ? short(number) : String(value),
      column: 2,
      preview: number !== null ? 'value' : 'none',
      target: { kind: 'parameter', id },
      controls:
        number !== null
          ? [
              {
                kind: 'number',
                id,
                label: 'base',
                value: number,
                min: control.type === 'number' ? (control.min ?? 0) : 0,
                max: control.type === 'number' ? (control.max ?? Math.max(1, number * 2)) : Math.max(1, number * 2),
                step: control.type === 'number' ? (control.step ?? 0.01) : 0.01,
              },
            ]
          : typeof value === 'boolean'
            ? [{ kind: 'boolean', id, label: 'base', value }]
            : [{ kind: 'readout', id, label: 'base', value: String(value) }],
    })
    for (const document of running) if (drivenParameters(document.graph).includes(id)) link(`graph:${document.id}`, `parameter:${id}`)
  }

  // ── Scene: the real objects in the viewport ─────────────────────────────
  type SceneThing = { name?: string; type?: string; visible?: boolean; intensity?: number; isMesh?: boolean; isLight?: boolean; isCamera?: boolean; parent?: SceneThing | null }
  const objects: SceneThing[] = []
  let meshes = 0
  let lights = 0
  runtime.getScene()?.traverse(object => {
    const thing = object as unknown as SceneThing
    // A transform gizmo is editor furniture, not scene content.
    for (let node: SceneThing | null | undefined = thing; node; node = node.parent) if (/^TransformControls/.test(node.type ?? '')) return
    if (thing.isMesh) meshes++
    if (thing.isLight) lights++
    if (thing.isMesh || thing.isLight || thing.isCamera) objects.push(thing)
  })
  const shown = objects.slice(0, SCENE_LIMIT)
  shown.forEach((object, index) => {
    const kindLabel = object.isMesh ? 'mesh' : object.isLight ? 'light' : 'camera'
    const id = `object:${index}`
    place({
      id,
      kind: 'object',
      title: object.name || object.type || kindLabel,
      subtitle: kindLabel,
      detail: object.type,
      column: 3,
      muted: object.visible === false,
      target: { kind: 'object', name: object.name ?? '' },
      controls: [
        { kind: 'boolean', id: 'visible', label: 'visible', value: object.visible !== false },
        ...(typeof object.intensity === 'number' ? ([{ kind: 'number', id: 'intensity', label: 'intensity', value: object.intensity, min: 0, max: Math.max(4, object.intensity * 2), step: 0.01 }] as LiveControl[]) : []),
      ],
    })
    liveObjects.set(id, object as unknown as Record<string, unknown>)
  })
  if (objects.length > shown.length) place({ id: 'object:more', kind: 'object', title: `+${objects.length - shown.length} more`, subtitle: 'scene', column: 3, muted: true })
  for (const id of driven) {
    const featureId = id.split(':')[0]
    const feature = features.find(item => item.id === featureId)
    if (feature && feature.kind !== 'effect') for (let index = 0; index < shown.length; index++) link(`parameter:${id}`, `object:${index}`)
  }

  // ── Render: the pipeline in the order it actually runs ───────────────────
  const host = features.find(feature => feature.id === 'postfx')
  const pipeline = host ? on(host.id) : false
  const scenePass = place({
    id: 'pass:scene',
    kind: 'pass',
    title: 'Scene Pass',
    subtitle: 'render',
    detail: `${meshes} meshes · ${lights} lights`,
    column: 4,
    preview: 'render',
    target: { kind: 'pass', id: 'pass:scene' },
  })
  shown.forEach((_, index) => link(`object:${index}`, scenePass.id))

  // The G-buffer targets the pipeline actually rendered this build.
  const published = new Set(pipelineStages.getStages().map(stage => stage.id))
  const attachments: string[] = []
  for (const attachment of ['depth', 'normal', 'velocity', 'metalRoughness']) {
    if (!published.has(`pass:${attachment}`)) continue
    attachments.push(attachment)
    place({ id: `pass:${attachment}`, kind: 'pass', title: attachment, subtitle: 'g-buffer', column: 4, preview: 'render', target: { kind: 'pass', id: `pass:${attachment}` } })
    link(scenePass.id, `pass:${attachment}`)
  }

  const active = features
    .filter(feature => feature.kind === 'effect' && on(feature.id))
    .sort((a, b) => (state.features[a.id]?.order ?? a.order ?? 500) - (state.features[b.id]?.order ?? b.order ?? 500))

  let previous = scenePass.id
  for (const feature of active) {
    const node = place({
      id: `effect:${feature.id}`,
      kind: 'effect',
      title: feature.label,
      subtitle: 'postfx',
      detail: feature.category,
      column: 4,
      muted: !pipeline,
      target: { kind: 'effect', id: feature.id },
      controls: [{ kind: 'boolean', id: 'enabled', label: 'enabled', value: true }, ...controlsOf(feature.id, values(feature.id), feature.controls)],
    })
    link(previous, node.id)
    // Effects that read an attachment are wired from it, as in the original.
    for (const attachment of attachments) if ((NEEDS[feature.id] ?? []).includes(attachment)) link(`pass:${attachment}`, node.id)
    for (const id of driven) if (id.startsWith(`${feature.id}:`)) link(`parameter:${id}`, node.id)
    previous = node.id
  }

  place({
    id: 'pass:output',
    kind: 'output',
    title: 'Output',
    subtitle: 'canvas',
    detail: active.length ? `${active.length} effect${active.length > 1 ? 's' : ''}${pipeline ? '' : ' · bypassed'}` : 'no postfx',
    column: 4,
    preview: 'render',
    target: { kind: 'pass', id: 'pass:output' },
  })
  link(previous, 'pass:output')

  return { nodes, edges, columns: LIVE_COLUMNS }
}

/**
 * Which live node a published pipeline stage belongs to. The PostFX host knows
 * effects by the id they register with ('bloom'), the graph knows them by their
 * feature id ('effect.bloom'), so the two are matched here.
 */
export function liveNodeForStage(stageId: string): string {
  if (stageId.startsWith('pass:')) return stageId
  const feature = features.find(item => item.kind === 'effect' && (item.id === `effect.${stageId}` || item.id.endsWith(`.${stageId}`)))
  return feature ? `effect:${feature.id}` : `effect:${stageId}`
}

/** Apply a control edit from the live view back to the thing it stands for. */
export function applyLiveControl(nodeId: string, controlId: string, value: number | boolean | string) {
  const kind = nodeId.slice(0, nodeId.indexOf(':'))
  const id = nodeId.slice(nodeId.indexOf(':') + 1)
  if (kind === 'graph') {
    graphs.setRunning(id, !!value)
    return
  }
  if (kind === 'object') {
    const object = liveObjects.get(nodeId) as unknown as { visible: boolean; intensity?: number } | undefined
    if (!object) return
    if (controlId === 'visible') object.visible = !!value
    if (controlId === 'intensity' && typeof value === 'number') object.intensity = value
    return
  }
  if (controlId === 'enabled' && (kind === 'feature' || kind === 'effect')) {
    studio.setEnabled(id, !!value)
    return
  }
  if (nodeId === 'pass:scene' && controlId === 'enabled') {
    studio.setEnabled('postfx', !!value)
    return
  }
  // Everything else addresses a control directly: `feature.id:control`.
  const [featureId, control] = controlId.split(':')
  if (featureId && control) studio.setValue(featureId, control, value)
}
