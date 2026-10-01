import { useSyncExternalStore } from 'react'
import { InspectorBase, type WebGPURenderer } from 'three/webgpu'
import { RendererInspector } from 'three/addons/inspector/RendererInspector.js'
import { runtime } from './runtime'

/**
 * The renderer profiler — the useful half of three.js's Inspector, without its
 * UI: every render and compute pass of a frame with its CPU and GPU time, and
 * the renderer's memory by kind. three's own `RendererInspector` collects the
 * frames (the renderer calls it around every frame and pass); this store
 * averages them and publishes a snapshot four times a second.
 *
 * It is attached only while something reads it (the Console panel's
 * Performance and Memory views) — GPU timestamp queries cost a little, so
 * nothing is measured while no one is looking.
 */

export interface PassStat {
  id: string
  name: string
  kind: 'render' | 'compute'
  /** Averaged milliseconds, this pass and the passes nested in it. */
  cpu: number
  gpu: number
  children: PassStat[]
}

export interface MemoryRow {
  name: string
  count: number
  /** Bytes, when the renderer tracks a size for this kind. */
  bytes: number | null
}

export interface ProfileSnapshot {
  attached: boolean
  /** The device exposes `timestamp-query`: GPU times are real, not zero. */
  gpuTimings: boolean
  fps: number
  cpu: number
  gpu: number
  /** Frame time left after every pass: JavaScript, compositing, waiting. */
  idle: number
  passes: PassStat[]
  cpuHistory: number[]
  gpuHistory: number[]
  memory: MemoryRow[]
  memoryTotal: number
  memoryHistory: number[]
}

/* The shape of three's per-frame records (RendererInspector keeps them untyped). */
interface ObjectStats {
  cid: string
  name: string
  cpu: number
  gpu: number
  isComputeStats?: boolean
  renderTarget?: { texture?: { name?: string } } | null
  children: ObjectStats[]
}
interface FrameStats {
  children: ObjectStats[]
}

const HISTORY = 60
const PUBLISH_MS = 250
/** Weight of the newest frame in a pass's running average. */
const SMOOTHING = 0.08

const EMPTY: ProfileSnapshot = {
  attached: false,
  gpuTimings: false,
  fps: 0,
  cpu: 0,
  gpu: 0,
  idle: 0,
  passes: [],
  cpuHistory: [],
  gpuHistory: [],
  memory: [],
  memoryTotal: 0,
  memoryHistory: [],
}

/** Collects resolved frames: each pass's time, averaged across frames by its call id. */
class StudioInspector extends RendererInspector {
  averages = new Map<string, { cpu: number; gpu: number }>()
  latest: FrameStats | null = null

  resolveFrame(frame: FrameStats) {
    const visit = (stats: ObjectStats) => {
      const previous = this.averages.get(stats.cid)
      const cpu = stats.cpu || 0
      const gpu = stats.gpu || 0
      this.averages.set(stats.cid, previous ? { cpu: previous.cpu + (cpu - previous.cpu) * SMOOTHING, gpu: previous.gpu + (gpu - previous.gpu) * SMOOTHING } : { cpu, gpu })
      stats.children.forEach(visit)
    }
    frame.children.forEach(visit)
    this.latest = frame
  }

  /** The latest frame as a tree of averaged passes; a pass's time includes its children. */
  passes(): PassStat[] {
    const build = (stats: ObjectStats): PassStat => {
      const own = this.averages.get(stats.cid) ?? { cpu: 0, gpu: 0 }
      const children = stats.children.map(build)
      const target = stats.renderTarget?.texture?.name
      const base = stats.name || `Unnamed ${stats.cid}`
      return {
        id: stats.cid,
        name: base === 'QuadMesh' && target ? target : base,
        kind: stats.isComputeStats ? 'compute' : 'render',
        cpu: own.cpu + children.reduce((sum, child) => sum + child.cpu, 0),
        gpu: own.gpu + children.reduce((sum, child) => sum + child.gpu, 0),
        children,
      }
    }
    return this.latest?.children.map(build) ?? []
  }
}

type Memory = Record<string, number>
const MEMORY_KINDS: Array<[name: string, count: string, size: string | null]> = [
  ['Textures', 'textures', 'texturesSize'],
  ['Attributes', 'attributes', 'attributesSize'],
  ['Index attributes', 'indexAttributes', 'indexAttributesSize'],
  ['Storage attributes', 'storageAttributes', 'storageAttributesSize'],
  ['Indirect storage', 'indirectStorageAttributes', 'indirectStorageAttributesSize'],
  ['Uniform buffers', 'uniformBuffers', 'uniformBuffersSize'],
  ['Programs', 'programs', 'programsSize'],
  ['Readback buffers', 'readbackBuffers', 'readbackBuffersSize'],
  ['Render targets', 'renderTargets', null],
  ['Geometries', 'geometries', null],
]

let snapshot = EMPTY
let inspector: StudioInspector | null = null
let host: WebGPURenderer | null = null
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

const hasTimestamps = (renderer: WebGPURenderer) => (renderer as unknown as { hasFeature?: (name: string) => boolean }).hasFeature?.('timestamp-query') === true
const backendOf = (renderer: WebGPURenderer) => (renderer as unknown as { backend?: { trackTimestamp?: boolean } }).backend

function attach() {
  const renderer = runtime.getRenderer()
  if (!renderer || (host === renderer && renderer.inspector === inspector)) return
  detach()
  inspector = new StudioInspector()
  host = renderer
  renderer.inspector = inspector
  const backend = backendOf(renderer)
  if (backend && hasTimestamps(renderer)) backend.trackTimestamp = true
}

function detach() {
  if (!host || !inspector) return
  if (host.inspector === inspector) host.inspector = new InspectorBase()
  // Detaching nulls its renderer, but a timestamp read it queued for the next
  // frame still runs and reads it: keep it pointed at the live renderer.
  inspector.setRenderer(host)
  const backend = backendOf(host)
  if (backend) backend.trackTimestamp = false
  inspector = null
  host = null
}

function publish() {
  attach()
  const renderer = host
  if (!renderer || !inspector) return
  const passes = inspector.passes()
  const cpu = passes.reduce((sum, pass) => sum + pass.cpu, 0)
  const gpu = passes.reduce((sum, pass) => sum + pass.gpu, 0)
  const fps = (inspector as unknown as { fps?: number }).fps ?? 0
  const memory = ((renderer as unknown as { info?: { memory?: Memory } }).info?.memory ?? {}) as Memory
  const total = memory.total ?? 0
  snapshot = {
    attached: true,
    gpuTimings: hasTimestamps(renderer),
    fps,
    cpu,
    gpu,
    idle: fps > 0 ? Math.max(0, 1000 / fps - cpu) : 0,
    passes,
    cpuHistory: [...snapshot.cpuHistory, cpu].slice(-HISTORY),
    gpuHistory: [...snapshot.gpuHistory, gpu].slice(-HISTORY),
    memory: MEMORY_KINDS.map(([name, count, size]) => ({ name, count: memory[count] ?? 0, bytes: size ? (memory[size] ?? 0) : null })),
    memoryTotal: total,
    memoryHistory: [...snapshot.memoryHistory, total].slice(-HISTORY),
  }
  listeners.forEach(listener => listener())
}

export const profiler = {
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    if (!timer) {
      publish()
      timer = setInterval(publish, PUBLISH_MS)
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size || !timer) return
      clearInterval(timer)
      timer = null
      detach()
      snapshot = EMPTY
    }
  },
}

export function useProfiler(): ProfileSnapshot {
  return useSyncExternalStore(profiler.subscribe, profiler.getSnapshot, profiler.getSnapshot)
}

export const formatBytes = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`)
