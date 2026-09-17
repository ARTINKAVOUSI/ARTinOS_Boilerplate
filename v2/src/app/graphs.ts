/**
 * Graphs — the documents the Graph panel edits, and the loop that runs them.
 *
 * A graph reads live signals and control values, shapes them with its nodes and
 * writes the result back to signals or controls. That is the modulation layer:
 * "audio.bass drives Bloom strength" is a three-node graph, not code.
 *
 * Parameter writes are deliberately throttled (`WRITE_HZ`): a control write goes
 * through the studio store, which re-renders every panel subscribed to it, so
 * driving one at full frame rate would cost more than the effect it animates.
 * Signal writes are free and happen every frame.
 *
 * The authored value of a driven control is remembered when a graph starts and
 * put back when it stops, so modulation never eats what you typed.
 */
import { useSyncExternalStore } from 'react'
import { evaluate, validateGraph, drivenParameters, type GraphDefinition } from '../ui/NodeGraph/graph'
import { signalBus } from '../features/input/signals'
import { features } from './registry'
import { studio } from './store'

export interface GraphDocument {
  id: string
  name: string
  /** Off graphs are kept and edited, they simply do not run. */
  running: boolean
  graph: GraphDefinition
}

export interface GraphsState {
  documents: GraphDocument[]
  /** Each running graph's last node outputs, for the editor readouts. */
  readouts: Record<string, ReadonlyMap<string, number>>
}

const STORAGE_KEY = 'artinos.v2.graphs'
const WRITE_HZ = 20
/** Readouts are for the eye, so the editor is refreshed far below frame rate. */
const READOUT_HZ = 10

const emptyGraph = (): GraphDefinition => ({ nodes: [], edges: [] })

function load(): GraphDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { documents?: GraphDocument[] }
    return (parsed.documents ?? []).map(document => ({
      id: String(document.id),
      name: String(document.name ?? 'Graph'),
      running: !!document.running,
      graph: { nodes: document.graph?.nodes ?? [], edges: document.graph?.edges ?? [] },
    }))
  } catch {
    return []
  }
}

let documents = load()
let readouts: GraphsState['readouts'] = {}
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let snapshot: GraphsState = { documents, readouts }

function publish(persist: boolean) {
  snapshot = { documents, readouts }
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

const readParameter = (id: string) => {
  const [featureId, control] = id.split(':')
  const value = studio.getState().features[featureId]?.values[control]
  return typeof value === 'number' ? value : 0
}

// The authored value of every control a graph has taken over.
const authored = new Map<string, number>()
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
let pendingWrites = new Map<string, number>()

function tick(now: number) {
  frame = requestAnimationFrame(tick)
  const time = (now - startedAt) / 1000
  const delta = Math.min(0.25, (now - last) / 1000) || 1 / 60
  last = now
  const writing = now - lastWrite >= 1000 / WRITE_HZ
  const next: GraphsState['readouts'] = {}

  for (const document of documents) {
    if (!document.running) continue
    const context = {
      time,
      delta,
      memory,
      readSignal: (id: string) => signalBus.get(id),
      readParameter,
      writeSignal: (id: string, value: number) => signalBus.set(id, value),
      writeParameter: (id: string, value: number) => pendingWrites.set(id, value),
    }
    try {
      next[document.id] = evaluate(document.graph, context)
    } catch (error) {
      console.error(`[graphs] ${document.name} failed and was stopped`, error)
      graphs.setRunning(document.id, false)
    }
  }

  if (writing && pendingWrites.size) {
    lastWrite = now
    for (const [id, value] of pendingWrites) {
      const [featureId, control] = id.split(':')
      if (!featureId || !control) continue
      if (!authored.has(id)) authored.set(id, readParameter(id))
      studio.setValue(featureId, control, value)
    }
    pendingWrites = new Map()
  }

  if (now - lastReadout >= 1000 / READOUT_HZ) {
    lastReadout = now
    readouts = next
    publish(false)
  }
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
  }
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

  create(name = `Graph ${documents.length + 1}`) {
    const document: GraphDocument = { id: `graph-${Date.now().toString(36)}`, name, running: false, graph: emptyGraph() }
    update([...documents, document])
    return document.id
  },

  remove(id: string) {
    update(documents.filter(document => document.id !== id))
  },

  rename(id: string, name: string) {
    update(documents.map(document => (document.id === id ? { ...document, name } : document)))
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

// A graph saved as running keeps running after a reload.
sync()
