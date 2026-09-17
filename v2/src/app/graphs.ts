/**
 * Graphs — the documents the Graph panel edits, and the loop that runs them.
 *
 * Every domain runs here against one host: `signal` and `parameter` graphs
 * shape numbers and write controls; `scene` graphs drive real objects in the
 * live scene; `render` graphs switch, reorder and drive the effect chain; `gpu`
 * graphs compile to TSL and are rendered by the Graph effect.
 *
 * Control writes are throttled (`WRITE_HZ`): a control write goes through the
 * studio store, which re-renders every panel subscribed to it, so driving one at
 * full frame rate would cost more than the effect it animates. Signal writes,
 * scene writes and uniform pushes are free and happen every frame.
 *
 * The authored value of a driven control is remembered when a graph starts and
 * put back when it stops, so modulation never eats what you typed.
 */
import { useSyncExternalStore } from 'react'
import type { Material, Mesh } from 'three'
import { createNode, drivenParameters, evaluate, validateGraph, type GraphDefinition, type GraphDiagnostic, type GraphDomain, type GraphHost, type GraphObject } from '../ui/NodeGraph/graph'
import { compileGPU, refreshUniforms, type CompiledGraph } from '../ui/NodeGraph/gpu'
import { compiledGraphs } from './compiled-graphs'
import { signalBus } from '../features/input/signals'
import { features, findFeature } from './registry'
import { runtime } from './runtime'
import { studio } from './store'

export interface GraphDocument {
  id: string
  name: string
  domain: GraphDomain
  /** Off graphs are kept and edited, they simply do not run. */
  running: boolean
  graph: GraphDefinition
}

export interface GraphsState {
  documents: GraphDocument[]
  /** Each running graph's last node outputs, for the editor readouts. */
  readouts: Record<string, ReadonlyMap<string, unknown>>
  /** Anything a running graph could not do this frame. */
  diagnostics: Record<string, GraphDiagnostic[]>
  /** Compiled GPU graphs, by document id. */
  compiled: Record<string, CompiledGraph>
  revision: number
}

const STORAGE_KEY = 'artinos.v2.graphs'
const WRITE_HZ = 20
/** Readouts are for the eye, so the editor is refreshed far below frame rate. */
const READOUT_HZ = 10

const emptyGraph = (domain: GraphDomain): GraphDefinition => ({ domain, nodes: [], edges: [] })

function load(): GraphDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { documents?: GraphDocument[] }
    return (parsed.documents ?? []).map(document => ({
      id: String(document.id),
      name: String(document.name ?? 'Graph'),
      domain: (document.domain ?? document.graph?.domain ?? 'signal') as GraphDomain,
      running: !!document.running,
      graph: { domain: (document.graph?.domain ?? document.domain ?? 'signal') as GraphDomain, nodes: document.graph?.nodes ?? [], edges: document.graph?.edges ?? [], groups: document.graph?.groups ?? [] },
    }))
  } catch {
    return []
  }
}

let documents = load()
let readouts: GraphsState['readouts'] = {}
let diagnostics: GraphsState['diagnostics'] = {}
let compiled: GraphsState['compiled'] = {}
let revision = 0
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let snapshot: GraphsState = { documents, readouts, diagnostics, compiled, revision }

function publish(persist: boolean) {
  revision++
  snapshot = { documents, readouts, diagnostics, compiled, revision }
  listeners.forEach(listener => listener())
  if (!persist) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ documents }))
    } catch {
      /* storage unavailable — the session still works */
    }
  }, 200)
}

/** `feature.id:control` — how a graph addresses one control. */
export const parameterId = (featureId: string, control: string) => `${featureId}:${control}`

/** Every numeric control in the app, as graph parameter options. */
export function parameterOptions() {
  return features.flatMap(feature =>
    Object.entries(feature.controls ?? {})
      .filter(([, control]) => control.type === 'number')
      .map(([name, control]) => ({ id: parameterId(feature.id, name), label: `${feature.label} › ${control.label ?? name}` })),
  )
}

/** Every effect and its controls, for the render-domain pickers. */
export function effectOptions() {
  return features
    .filter(feature => feature.kind === 'effect')
    .map(feature => ({
      id: feature.id,
      label: feature.label,
      parameters: Object.entries(feature.controls ?? {})
        .filter(([, control]) => control.type === 'number' || control.type === 'boolean')
        .map(([name, control]) => ({ id: name, label: control.label ?? name })),
    }))
}

/** Named objects in the live scene, for the scene-domain picker. */
export const objectOptions = () => runtime.sceneObjects().map(object => object.name)

const readParameter = (id: string) => {
  const [featureId, control] = id.split(':')
  const value = studio.getState().features[featureId]?.values[control]
  return typeof value === 'number' ? value : typeof value === 'boolean' ? (value ? 1 : 0) : 0
}

// The authored value of every control a graph has taken over.
const authored = new Map<string, number | boolean>()
const restore = (id: string) => {
  const base = authored.get(id)
  authored.delete(id)
  if (base === undefined) return
  const [featureId, control] = id.split(':')
  studio.setValue(featureId, control, base)
}

const memory = new Map<string, number>()
let frame = 0
let startedAt = 0
let last = 0
let lastWrite = 0
let lastReadout = 0
let pendingWrites = new Map<string, number | boolean>()
const pendingEnable = new Map<string, boolean>()
const pendingOrder = new Map<string, number>()

/** What a graph can reach: signals, controls, the live scene, the effect chain. */
function host(): GraphHost {
  return {
    readSignal: id => signalBus.get(id),
    writeSignal: (id, value) => signalBus.set(id, value),
    readParameter,
    writeParameter: (id, value) => pendingWrites.set(id, value),
    findObject: name => runtime.sceneObjects().find(object => object.name === name) as unknown as GraphObject | undefined,
    writeMaterial: (object, property, value) => {
      const material = (object as unknown as Mesh).material as (Material & Record<string, unknown>) | undefined
      if (!material || Array.isArray(material)) return 'This object has no single material'
      if (!property || !(property in material)) return `The material has no property “${property}”`
      if (material[property] !== value) {
        material[property] = value
        material.needsUpdate = true
      }
      return undefined
    },
    hasEffect: id => !!findFeature(id),
    setEffectEnabled: (id, enabled) => pendingEnable.set(id, enabled),
    setEffectOrder: (id, order) => pendingOrder.set(id, order),
    setEffectParameter: (id, parameter, value) => pendingWrites.set(parameterId(id, parameter), value),
  }
}

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const time = (now - startedAt) / 1000
  const delta = Math.min(0.25, (now - last) / 1000) || 1 / 60
  last = now
  const io = host()
  const nextReadouts: GraphsState['readouts'] = {}
  const nextDiagnostics: GraphsState['diagnostics'] = {}

  for (const document of documents) {
    if (!document.running) continue
    if (document.domain === 'gpu') {
      // Compiled once per definition; every frame only pushes uniforms.
      const build = compiled[document.id]
      if (build) refreshUniforms(build.uniforms, io)
      continue
    }
    const notes: GraphDiagnostic[] = []
    try {
      nextReadouts[document.id] = evaluate(document.graph, { ...io, time, delta, memory, diagnostics: notes })
    } catch (error) {
      console.error(`[graphs] ${document.name} failed and was stopped`, error)
      graphs.setRunning(document.id, false)
    }
    if (notes.length) nextDiagnostics[document.id] = notes
  }

  // Effect switches and order are cheap but still go through the store, so they
  // ride the same throttle as control writes.
  if (now - lastWrite >= 1000 / WRITE_HZ && (pendingWrites.size || pendingEnable.size || pendingOrder.size)) {
    lastWrite = now
    for (const [id, enabled] of pendingEnable) studio.setEnabled(id, enabled)
    for (const [id, order] of pendingOrder) studio.setOrder(id, order)
    for (const [id, value] of pendingWrites) {
      const [featureId, control] = id.split(':')
      if (!featureId || !control) continue
      if (!authored.has(id)) {
        const current = studio.getState().features[featureId]?.values[control]
        if (typeof current === 'number' || typeof current === 'boolean') authored.set(id, current)
      }
      studio.setValue(featureId, control, value)
    }
    pendingWrites = new Map()
    pendingEnable.clear()
    pendingOrder.clear()
  }

  if (now - lastReadout >= 1000 / READOUT_HZ) {
    lastReadout = now
    readouts = nextReadouts
    diagnostics = nextDiagnostics
    publish(false)
  }
}

/** Compile every running GPU graph; the Graph effect renders what they publish. */
function compileAll() {
  const next: GraphsState['compiled'] = {}
  const io = host()
  for (const document of documents) {
    if (document.domain !== 'gpu' || !document.running) continue
    try {
      next[document.id] = compileGPU(document.graph, io)
    } catch (error) {
      next[document.id] = { node: null, uniforms: [], values: new Map(), diagnostics: [{ severity: 'error', message: error instanceof Error ? error.message : String(error) }] }
    }
  }
  compiled = next
  // The Graph effect reads the published nodes; it cannot import this module.
  compiledGraphs.publish(documents.filter(document => next[document.id]?.node).map(document => ({ id: document.id, name: document.name, node: next[document.id].node })))
}

function sync() {
  const running = documents.some(document => document.running)
  if (running && !frame) {
    startedAt = performance.now()
    last = startedAt
    frame = requestAnimationFrame(tick)
  }
  if (!running && frame) {
    cancelAnimationFrame(frame)
    frame = 0
    readouts = {}
    diagnostics = {}
  }
  compileAll()
  // Controls no graph drives any more go back to the value that was typed.
  const driven = new Set(documents.filter(document => document.running).flatMap(document => drivenParameters(document.graph)))
  for (const id of [...authored.keys()]) if (!driven.has(id)) restore(id)
}

const update = (next: GraphDocument[]) => {
  documents = next
  sync()
  publish(true)
}

export const graphs = {
  getState: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  create(name = `Graph ${documents.length + 1}`, domain: GraphDomain = 'signal', graph?: GraphDefinition) {
    const document: GraphDocument = { id: `graph-${Date.now().toString(36)}`, name, domain, running: false, graph: graph ?? emptyGraph(domain) }
    update([...documents, document])
    return document.id
  },

  remove(id: string) {
    update(documents.filter(document => document.id !== id))
  },

  rename(id: string, name: string) {
    update(documents.map(document => (document.id === id ? { ...document, name } : document)))
  },

  /** Changing domain keeps the nodes that the new domain also supports. */
  setDomain(id: string, domain: GraphDomain) {
    update(documents.map(document => (document.id === id ? { ...document, domain, running: false, graph: { ...document.graph, domain } } : document)))
  },

  setRunning(id: string, running: boolean) {
    const document = documents.find(item => item.id === id)
    if (!document) return
    // A graph with an error would write nonsense to a control; refuse to start it.
    if (running && validateGraph(document.graph).some(item => item.severity === 'error')) return
    update(documents.map(item => (item.id === id ? { ...item, running } : item)))
  },

  setGraph(id: string, graph: GraphDefinition) {
    update(documents.map(document => (document.id === id ? { ...document, graph } : document)))
  },

  exportJSON: () => JSON.stringify({ documents }, null, 2),

  importJSON(text: string) {
    const parsed = JSON.parse(text) as { documents?: GraphDocument[] }
    if (!Array.isArray(parsed.documents)) throw new Error('No graphs in that file')
    update([...documents, ...parsed.documents.map(document => ({ ...document, id: `graph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, running: false }))])
  },
}

export function useGraphs(): GraphsState {
  return useSyncExternalStore(graphs.subscribe, graphs.getState, graphs.getState)
}

// ── Templates ──────────────────────────────────────────────────────────────
export interface GraphTemplate {
  id: string
  name: string
  domain: GraphDomain
  description: string
  build(): GraphDefinition
}

const column = (index: number) => 30 + index * 230
const row = (index: number) => 30 + index * 170
const chain = (ids: string[]): GraphDefinition['edges'] => ids.slice(0, -1).map((id, index) => ({ id: `edge-${index}`, from: id, to: ids[index + 1], output: 'value', input: 'value', order: index }))

export const GRAPH_TEMPLATES: readonly GraphTemplate[] = [
  { id: 'blank', name: 'Blank', domain: 'signal', description: 'An empty canvas.', build: () => emptyGraph('signal') },
  {
    id: 'audio-pulse',
    name: 'Audio → control',
    domain: 'signal',
    description: 'Smooths audio energy, shapes it and drives a control every frame.',
    build: () => {
      const nodes = [
        createNode('signal', column(0), row(0), { id: 'audio.bass' }),
        createNode('smooth', column(1), row(0), { amount: 0.82 }),
        createNode('remap', column(2), row(0), { inMin: 0, inMax: 1, outMin: 0, outMax: 1.4 }),
        createNode('write-parameter', column(3), row(0), { id: '' }),
      ]
      return { domain: 'signal', nodes, edges: chain(nodes.map(node => node.id)) }
    },
  },
  {
    id: 'oscillator',
    name: 'Oscillator → signal',
    domain: 'signal',
    description: 'A free-running waveform published as a signal anything can read.',
    build: () => {
      const nodes = [createNode('oscillator', column(0), row(0), { wave: 'sine', frequency: 0.25, amplitude: 0.5, offset: 0.5 }), createNode('write-signal', column(1), row(0), { id: 'graph.oscillator' })]
      return { domain: 'signal', nodes, edges: chain(nodes.map(node => node.id)) }
    },
  },
  {
    id: 'reactive-bloom',
    name: 'Reactive bloom',
    domain: 'render',
    description: 'Drives bloom strength from smoothed audio energy.',
    build: () => {
      const nodes = [
        createNode('signal', column(0), row(0), { id: 'audio.bass' }),
        createNode('smooth', column(1), row(0), { amount: 0.78 }),
        createNode('remap', column(2), row(0), { inMin: 0, inMax: 1, outMin: 0.15, outMax: 1.2 }),
        createNode('effect-parameter', column(3), row(0), { id: 'effect.bloom', parameter: 'strength' }),
      ]
      return { domain: 'render', nodes, edges: chain(nodes.map(node => node.id)) }
    },
  },
  {
    id: 'scene-motion',
    name: 'Scene motion',
    domain: 'scene',
    description: 'Floats a named scene object on a sine wave.',
    build: () => {
      const oscillator = createNode('oscillator', column(0), row(0), { wave: 'sine', frequency: 0.3, amplitude: 0.4, offset: 0 })
      const object = createNode('scene-object', column(0), row(1), { object: objectOptions()[0] ?? '' })
      const transform = createNode('transform', column(2), row(0), {})
      return {
        domain: 'scene',
        nodes: [oscillator, object, transform],
        edges: [
          { id: 'edge-0', from: object.id, to: transform.id, output: 'object', input: 'object', order: 0 },
          { id: 'edge-1', from: oscillator.id, to: transform.id, output: 'value', input: 'positionY', order: 1 },
        ],
      }
    },
  },
  {
    id: 'tsl-pulse',
    name: 'TSL pulse',
    domain: 'gpu',
    description: 'Compiles a signal-driven TSL node the Graph effect renders into the chain.',
    build: () => {
      const nodes = [createNode('signal', column(0), row(0), { id: 'audio.level' }), createNode('smoothstep', column(1), row(0), { min: 0, max: 1 }), createNode('output', column(2), row(0), {})]
      return { domain: 'gpu', nodes, edges: chain(nodes.map(node => node.id)) }
    },
  },
]

// A graph saved as running keeps running after a reload.
sync()
