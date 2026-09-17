/**
 * The live graph: what is actually running on the page, read back as nodes.
 *
 * Nothing here is authored. Every node and wire is derived from the registry,
 * the studio state, the signal bus and the graph documents on the frame it is
 * built, so the picture is the pipeline — inputs produce signals, graphs shape
 * them, controls carry them into features, and the render column shows the
 * scene pass, the G-buffer it writes and the effect chain to the canvas.
 */
import { features } from './registry'
import { studio } from './store'
import { graphs, parameterId } from './graphs'
import { signalBus } from '../features/input/signals'
import { drivenParameters, fieldValue } from '../ui/NodeGraph/graph'
import { liveNodeHeight, type LiveControl, type LiveEdge, type LiveGraphData, type LiveNode } from '../ui/NodeGraph/LiveGraph'

export const LIVE_COLUMNS = ['Input', 'Graphs', 'Controls', 'Scene', 'Render']
const ROW_GAP = 14
const SIGNAL_LIMIT = 14
const short = (value: number) => (Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3))

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
  'effect.denoise': ['normal', 'depth'],
  'effect.recurrent-denoise': ['normal', 'depth', 'velocity'],
}

export function buildLiveGraph(): LiveGraphData {
  const state = studio.getState()
  const documents = graphs.getState().documents
  const nodes: LiveNode[] = []
  const edges: LiveEdge[] = []
  const cursor = [0, 0, 0, 0, 0]

  const place = (node: Omit<LiveNode, 'y'>) => {
    const placed: LiveNode = { ...node, y: cursor[node.column] }
    cursor[node.column] += liveNodeHeight(placed) + ROW_GAP
    nodes.push(placed)
    return placed
  }
  const has = (id: string) => nodes.some(node => node.id === id)
  const link = (from: string, to: string) => {
    if (!has(from) || !has(to) || edges.some(edge => edge.id === `${from}->${to}`)) return
    edges.push({ id: `${from}->${to}`, from, to })
  }

  const on = (id: string) => !!state.features[id]?.enabled
  const values = (id: string) => state.features[id]?.values ?? {}

  // ── Input: the devices that are on, and the signals they are writing ──────
  const inputFeatures = features.filter(feature => feature.group === 'Input')
  for (const feature of inputFeatures) {
    place({
      id: `feature:${feature.id}`,
      title: feature.label,
      subtitle: 'input',
      detail: feature.description,
      column: 0,
      tone: 'input',
      muted: !on(feature.id),
      controls: [{ kind: 'boolean', id: 'enabled', label: 'capture', value: on(feature.id) }],
    })
  }

  const live = signalBus.entries().filter(([name]) => signalBus.age(name) < 2000)
  const consumed = new Set(documents.flatMap(document => document.graph.nodes.filter(node => node.type === 'signal').map(node => String(fieldValue(node, 'id') ?? ''))))
  const shown = [...new Set([...live.map(([name]) => name), ...consumed])].filter(Boolean).sort().slice(0, SIGNAL_LIMIT)
  for (const name of shown) {
    const value = signalBus.get(name)
    place({
      id: `signal:${name}`,
      title: name,
      subtitle: 'signal',
      value: short(value),
      column: 0,
      tone: 'input',
      muted: signalBus.age(name) > 2000,
    })
    // A signal's prefix is its writer: `audio.bass` comes from the audio device.
    const owner = inputFeatures.find(feature => feature.id.split('.').pop()?.startsWith(name.split('.')[0]) || feature.label.toLowerCase().startsWith(name.split('.')[0]))
    if (owner) link(`feature:${owner.id}`, `signal:${name}`)
  }

  // ── Graphs: the authored documents, and what they read and write ─────────
  const running = documents.filter(document => document.running)
  for (const document of documents) {
    place({
      id: `graph:${document.id}`,
      title: document.name,
      subtitle: 'graph',
      detail: `${document.graph.nodes.length} nodes · ${document.graph.edges.length} wires`,
      column: 1,
      tone: 'logic',
      muted: !document.running,
      controls: [{ kind: 'boolean', id: 'running', label: 'run', value: document.running }],
    })
    for (const node of document.graph.nodes) if (node.type === 'signal') link(`signal:${String(fieldValue(node, 'id') ?? '')}`, `graph:${document.id}`)
  }

  // ── Controls: the parameters a running graph is driving ─────────────────
  const driven = [...new Set(running.flatMap(document => drivenParameters(document.graph)))]
  for (const id of driven) {
    const [featureId, name] = id.split(':')
    const feature = features.find(item => item.id === featureId)
    const control = feature?.controls?.[name]
    if (!feature || !control || control.type !== 'number') continue
    const value = Number(values(featureId)[name] ?? control.value)
    place({
      id: `parameter:${id}`,
      title: control.label ?? name,
      subtitle: feature.label,
      column: 2,
      tone: 'parameter',
      value: short(value),
      controls: [{ kind: 'number', id, label: 'value', value, min: control.min ?? 0, max: control.max ?? Math.max(1, value * 2), step: control.step ?? 0.01 }],
    })
    for (const document of running) if (drivenParameters(document.graph).includes(id)) link(`graph:${document.id}`, `parameter:${id}`)
    link(`parameter:${id}`, feature.kind === 'effect' ? `effect:${feature.id}` : `feature:${feature.id}`)
  }

  // ── Scene: the features that actually draw ──────────────────────────────
  const scene = features.filter(feature => (feature.kind === 'scene' || feature.kind === 'app') && feature.group !== 'Input' && feature.group !== 'Diagnostics')
  for (const feature of scene.filter(feature => on(feature.id))) {
    place({
      id: `feature:${feature.id}`,
      title: feature.label,
      subtitle: (feature.group ?? feature.kind).toLowerCase(),
      detail: feature.path,
      column: 3,
      tone: 'scene',
      controls: [{ kind: 'boolean', id: 'enabled', label: 'enabled', value: true }],
    })
  }
  const offCount = scene.filter(feature => !on(feature.id)).length
  if (offCount) place({ id: 'feature:off', title: `${offCount} switched off`, subtitle: 'scene', column: 3, tone: 'scene', muted: true })

  // ── Render: scene pass, the G-buffer it writes, then the effect chain ────
  const host = features.find(feature => feature.id === 'postfx')
  const pipeline = host ? on(host.id) : false
  const scenePass = place({
    id: 'pass:scene',
    title: 'Scene Pass',
    subtitle: 'render',
    detail: 'Every enabled scene feature, drawn once',
    column: 4,
    tone: 'render',
    controls: host ? [{ kind: 'boolean', id: 'enabled', label: 'postfx', value: pipeline }] : [],
  })
  for (const feature of scene.filter(item => on(item.id))) link(`feature:${feature.id}`, scenePass.id)

  const active = features
    .filter(feature => feature.kind === 'effect' && on(feature.id))
    .sort((a, b) => (state.features[a.id]?.order ?? a.order ?? 500) - (state.features[b.id]?.order ?? b.order ?? 500))

  // Only the attachments the active chain actually asks for exist this frame.
  const attachments = [...new Set(active.flatMap(feature => NEEDS[feature.id] ?? []))]
  for (const attachment of attachments) {
    place({ id: `pass:${attachment}`, title: attachment, subtitle: 'g-buffer', column: 4, tone: 'render', muted: !pipeline })
    link(scenePass.id, `pass:${attachment}`)
  }

  let previous = scenePass.id
  for (const feature of active) {
    const controls: LiveControl[] = [{ kind: 'boolean', id: 'enabled', label: 'enabled', value: true }]
    for (const [name, control] of Object.entries(feature.controls ?? {}).slice(0, 3)) {
      const value = values(feature.id)[name]
      if (control.type === 'number' && typeof value === 'number') {
        controls.push({ kind: 'number', id: parameterId(feature.id, name), label: control.label ?? name, value, min: control.min ?? 0, max: control.max ?? Math.max(1, value * 2), step: control.step ?? 0.01 })
      } else if (control.type === 'boolean' && typeof value === 'boolean') {
        controls.push({ kind: 'boolean', id: parameterId(feature.id, name), label: control.label ?? name, value })
      }
    }
    const node = place({ id: `effect:${feature.id}`, title: feature.label, subtitle: `postfx · ${feature.category ?? ''}`.trim(), detail: feature.path, column: 4, tone: 'render', muted: !pipeline, controls })
    link(previous, node.id)
    for (const attachment of NEEDS[feature.id] ?? []) link(`pass:${attachment}`, node.id)
    previous = node.id
  }

  place({ id: 'pass:output', title: 'Canvas', subtitle: 'output', detail: `${active.length} effect${active.length === 1 ? '' : 's'}${pipeline ? '' : ' · bypassed'}`, column: 4, tone: 'output' })
  link(previous, 'pass:output')

  return { nodes, edges, columns: LIVE_COLUMNS }
}

/** Apply a control edit from the live view back to the thing it stands for. */
export function applyLiveControl(nodeId: string, controlId: string, value: number | boolean) {
  const [kind, id] = [nodeId.slice(0, nodeId.indexOf(':')), nodeId.slice(nodeId.indexOf(':') + 1)]
  if (kind === 'graph') {
    graphs.setRunning(id, !!value)
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
