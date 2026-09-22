import { useSyncExternalStore } from 'react'
import type { Object3D, Scene } from 'three'
import type { WebGPURenderer } from 'three/webgpu'

/**
 * Live runtime facts the studio chrome reads: the renderer, the backend in use,
 * and a rolling frame-time history. One rAF sampler feeds every reader (the
 * dock HUD, the Telemetry panel), so opening more of them costs nothing extra.
 */

export interface RendererStats {
  calls: number
  triangles: number
  geometries: number
  textures: number
  width: number
  height: number
  pixelRatio: number
}

export interface RuntimeSnapshot {
  backend: 'webgpu' | 'webgl2' | null
  fps: number
  frameMs: number
  /** Most recent frame times, oldest first. */
  history: number[]
  /** Rolling FPS samples, 4 per second. */
  fpsHistory: number[]
  renderer: RendererStats
}

const HISTORY = 120
const FPS_HISTORY = 60

let renderer: WebGPURenderer | null = null
let scene: Scene | null = null
let snapshot: RuntimeSnapshot = {
  backend: null,
  fps: 0,
  frameMs: 0,
  history: [],
  fpsHistory: [],
  renderer: { calls: 0, triangles: 0, geometries: 0, textures: 0, width: 0, height: 0, pixelRatio: 1 },
}
const listeners = new Set<() => void>()
const frameTimes: number[] = []
let running = false

function readRenderer(): RendererStats {
  const info = (renderer as unknown as { info?: { render?: { drawCalls?: number; triangles?: number }; memory?: { geometries?: number; textures?: number } } } | null)?.info
  const canvas = renderer?.domElement
  return {
    calls: info?.render?.drawCalls ?? 0,
    triangles: info?.render?.triangles ?? 0,
    geometries: info?.memory?.geometries ?? 0,
    textures: info?.memory?.textures ?? 0,
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
    pixelRatio: renderer?.getPixelRatio?.() ?? 1,
  }
}

function start() {
  if (running || typeof window === 'undefined') return
  running = true
  let last = performance.now()
  let windowStart = last
  let frames = 0
  const tick = (now: number) => {
    frameTimes.push(now - last)
    if (frameTimes.length > HISTORY) frameTimes.shift()
    last = now
    frames++
    if (now - windowStart >= 250) {
      const fps = (frames * 1000) / (now - windowStart)
      const recent = frameTimes.slice(-30)
      snapshot = {
        ...snapshot,
        fps,
        frameMs: recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length),
        history: frameTimes.slice(),
        fpsHistory: [...snapshot.fpsHistory, fps].slice(-FPS_HISTORY),
        renderer: readRenderer(),
      }
      listeners.forEach(listener => listener())
      frames = 0
      windowStart = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export const runtime = {
  setRenderer(next: WebGPURenderer, backend: 'webgpu' | 'webgl2') {
    renderer = next
    snapshot = { ...snapshot, backend, renderer: readRenderer() }
    listeners.forEach(listener => listener())
  },
  getRenderer: () => renderer,

  /** The live scene, set by the Stage while the canvas is mounted. */
  setScene(next: Scene | null) {
    scene = next
  },
  getScene: () => scene,
  /**
   * Named objects in the live scene — what a scene graph can address. Editor
   * furniture (a transform gizmo's axes, all named X/Y/Z) is not scene content,
   * so it is skipped along with everything under it.
   */
  sceneObjects(): Object3D[] {
    const found: Object3D[] = []
    const seen = new Set<string>()
    scene?.traverse(object => {
      if (!object.name || seen.has(object.name)) return
      for (let node: Object3D | null = object; node; node = node.parent) if (/^TransformControls/.test(node.type)) return
      seen.add(object.name)
      found.push(object)
    })
    return found
  },
  getSnapshot: () => snapshot,
  subscribe(listener: () => void) {
    start()
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useRuntime(): RuntimeSnapshot {
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)
}

export const compactNumber = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
