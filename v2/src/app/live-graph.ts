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
import { drivenParameters, fieldValue } from '../ui/NodeGraph/graph'
import { LIVE_COLUMN_STEP, measureLiveNode, type LiveControl, type LiveEdge, type LiveGraph, type LiveKind, type LiveNode } from '../ui/NodeGraph/LiveGraphView'

export const LIVE_COLUMNS = ['Input', 'Logic', 'Parameters', 'Scene', 'Render']
const ROW_GAP = 18
const SIGNAL_LIMIT = 14
const SCENE_LIMIT = 14
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
  const kindOf = (kind: LiveKind) => kind

  // ── Input: the devices capturing, and the signals they are writing ────────
  const inputFeatures = features.filter(feature => feature.group === 'Input')
  for (const feature of inputFeatures) {
    place({
      id: `feature:${feature.id}`,
      kind: kindOf('object'),
      title: feature.label,
      subtitle: 'input',
      detail: feature.description,
      column: 0,
      muted: !on(feature.id),
      target: { kind: 'feature', id: feature.id },
      controls: [{ kind: 'boolean', id: 'enabled', label: 'capture', value: on(feature.id) }, ...(on(feature.id) ? controlsOf(feature.id, values(feature.id), feature.controls) : [])],
    })
  }

  const live = signalBus.entries().filter(([name]) => signalBus.age(name) < 2000)
  const consumed = new Set(documents.flatMap(document => document.graph.nodes.filter(node => node.type === 'signal').map(node => String(fieldValue(node, 'id') ?? ''))))
  const shown = [...new Set([...live.map(([name]) => name), ...consumed])].filter(Boolean).sort().slice(0, SIGNAL_LIMIT)
  for (const name of shown) {
    const value = signalBus.get(name)
    place({
      id: `signal:${name}`,
      kind: kindOf('signal'),
      title: name,
      subtitle: 'signal',
      value: short(value),
      column: 0,
      muted: signalBus.age(name) > 2000,
      preview: 'value',
      target: { kind: 'signal', id: name },
    })
    // A signal's prefix names its writer: `audio.bass` comes from the audio device.
    const owner = inputFeatures.find(feature => feature.id.endsWith(`.${name.split('.')[0]}`) || feature.label.toLowerCase().startsWith(name.split('.')[0]))
    if (owner) link(`feature:${owner.id}`, `signal:${name}`)
  }

  // ── Logic: the graphs consuming signals and writing parameters ───────────
  const running = documents.filter(document => document.running)
  for (const document of documents) {
    place({
      id: `graph:${document.id}`,
      kind: kindOf('graph'),
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
    place({
      id: `parameter:${id}`,
      kind: kindOf('parameter'),
      title: control.label ?? name,
      subtitle: 'parameter',
      detail: feature.label,
      value: typeof value === 'number' ? short(value) : String(value),
      column: 2,
      preview: typeof value === 'number' ? 'value' : 'none',
      target: { kind: 'parameter', id },
      controls:
        typeof value === 'number'
          ? [
              {
                kind: 'number',
                id,
                label: 'base',
                value,
                min: control.type === 'number' ? (control.min ?? 0) : 0,
                max: control.type === 'number' ? (control.max ?? Math.max(1, value * 2)) : Math.max(1, value * 2),
                step: control.type === 'number' ? (control.step ?? 0.01) : 0.01,
              },
            ]
          : typeof value === 'boolean'
            ? [{ kind: 'boolean', id, label: 'base', value }]
            : [{ kind: 'readout', id, label: 'base', value: String(value) }],
    })
    for (const document of running) if (drivenParameters(document.graph).includes(id)) link(`graph:${document.id}`, `parameter:${id}`)
    link(`parameter:${id}`, feature.kind === 'effect' ? `effect:${feature.id}` : `feature:${feature.id}`)
  }

  // ── Scene: the features drawing, and the real objects in the viewport ────
  const sceneFeatures = features.filter(feature => (feature.kind === 'scene' || feature.kind === 'app') && feature.group !== 'Input' && feature.group !== 'Diagnostics')
  for (const feature of sceneFeatures.filter(feature => on(feature.id))) {
    place({
      id: `feature:${feature.id}`,
      kind: kindOf('object'),
      title: feature.label,
      subtitle: (feature.group ?? feature.kind).toLowerCase(),
      detail: feature.path,
      column: 3,
      target: { kind: 'feature', id: feature.id },
      controls: [{ kind: 'boolean', id: 'enabled', label: 'enabled', value: true }, ...controlsOf(feature.id, values(feature.id), feature.controls)],
    })
  }
  const objects = runtime.sceneObjects().slice(0, SCENE_LIMIT)
  for (const object of objects) {
    const light = object as unknown as { isLight?: boolean; isMesh?: boolean; isCamera?: boolean; intensity?: number; visible: boolean; type: string }
    const kindLabel = light.isMesh ? 'mesh' : light.isLight ? 'light' : light.isCamera ? 'camera' : 'object'
    place({
      id: `object:${object.name}`,
      kind: kindOf('object'),
      title: object.name,
      subtitle: kindLabel,
      detail: light.type,
      column: 3,
      muted: light.visible === false,
      target: { kind: 'object', name: object.name },
      controls: [
        { kind: 'boolean', id: 'visible', label: 'visible', value: light.visible !== false },
        ...(typeof light.intensity === 'number' ? ([{ kind: 'number', id: 'intensity', label: 'intensity', value: light.intensity, min: 0, max: Math.max(4, light.intensity * 2), step: 0.01 }] as LiveControl[]) : []),
      ],
    })
  }

  // ── Render: the pipeline in the order it actually runs ───────────────────
  const host = features.find(feature => feature.id === 'postfx')
  const pipeline = host ? on(host.id) : false
  const scenePass = place({
    id: 'pass:scene',
    kind: kindOf('pass'),
    title: 'Scene Pass',
    subtitle: 'render',
    detail: `${objects.length} named objects`,
    column: 4,
    preview: 'render',
    target: { kind: 'pass', id: 'pass:scene' },
    controls: host ? [{ kind: 'boolean', id: 'enabled', label: 'postfx', value: pipeline }] : [],
  })
  for (const feature of sceneFeatures.filter(item => on(item.id))) link(`feature:${feature.id}`, scenePass.id)
  for (const object of objects) link(`object:${object.name}`, scenePass.id)

  const active = features
    .filter(feature => feature.kind === 'effect' && on(feature.id))
    .sort((a, b) => (state.features[a.id]?.order ?? a.order ?? 500) - (state.features[b.id]?.order ?? b.order ?? 500))

  // Only the attachments the active chain asks for exist this frame.
  const attachments = [...new Set(active.flatMap(feature => NEEDS[feature.id] ?? []))]
  for (const attachment of attachments) {
    place({ id: `pass:${attachment}`, kind: kindOf('pass'), title: attachment, subtitle: 'g-buffer', column: 4, muted: !pipeline, preview: 'render', target: { kind: 'pass', id: `pass:${attachment}` } })
    link(scenePass.id, `pass:${attachment}`)
  }

  let previous = scenePass.id
  for (const feature of active) {
    const node = place({
      id: `effect:${feature.id}`,
      kind: kindOf('effect'),
      title: feature.label,
      subtitle: 'postfx',
      detail: feature.category,
      column: 4,
      muted: !pipeline,
      // No thumbnail: an effect transforms the image it is handed, so a capture
      // after it is the whole chain so far, not this effect. The render targets
      // that do stand alone — the scene pass, the G-buffer, the output — carry
      // the previews.
      target: { kind: 'effect', id: feature.id },
      controls: [{ kind: 'boolean', id: 'enabled', label: 'enabled', value: true }, ...controlsOf(feature.id, values(feature.id), feature.controls)],
    })
    link(previous, node.id)
    for (const attachment of NEEDS[feature.id] ?? []) link(`pass:${attachment}`, node.id)
    for (const id of driven) if (id.startsWith(`${feature.id}:`)) link(`parameter:${id}`, node.id)
    previous = node.id
  }

  place({
    id: 'pass:output',
    kind: kindOf('output'),
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
    const object = runtime.sceneObjects().find(item => item.name === id) as unknown as { visible: boolean; intensity?: number } | undefined
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
