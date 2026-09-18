/**
 * Thumbnails for compiled TSL nodes, rendered with the one shared renderer.
 *
 * A GPU readback stalls the frame, so at most one thumbnail is produced per
 * interval and the queue is round-robined: N previewed nodes cost one extra
 * off-screen quad every INTERVAL, not N per frame. Captures are single-flight —
 * overlapping passes on a redirected renderer are the fastest way to wedge a
 * WebGPU device.
 */
import { NodeMaterial, QuadMesh, RenderTarget } from 'three/webgpu'
import { pow, vec3, vec4 } from 'three/tsl'
import type { PreviewFrame } from '../ui/NodeGraph/NodePreview'
import { runtime } from './runtime'

// 64 * 4 bytes = 256, the row alignment WebGPU pads readbacks to. At a size
// whose rows are not a multiple of 256 the returned buffer is padded and the
// image decodes as diagonal stripes.
const SIZE = 64
const INTERVAL = 400

type Renderer = {
  getRenderTarget(): unknown
  setRenderTarget(target: unknown): void
  getMRT?(): unknown
  setMRT?(value: unknown): void
  readRenderTargetPixelsAsync(target: unknown, x: number, y: number, width: number, height: number): Promise<ArrayBufferLike>
}

const requests = new Map<string, unknown>()
const frames = new Map<string, PreviewFrame>()
const failed = new Set<string>()
const listeners = new Set<() => void>()
let target: RenderTarget | null = null
let material: NodeMaterial | null = null
let quad: QuadMesh | null = null
let inFlight = false
let cursor = 0
let lastAt = 0
let snapshot: ReadonlyMap<string, PreviewFrame> = new Map()

const bump = () => {
  snapshot = new Map(frames)
  listeners.forEach(listener => listener())
}

async function capture(key: string, node: unknown) {
  const renderer = runtime.getRenderer() as unknown as Renderer | null
  if (!renderer) return
  if (!target) {
    target = new RenderTarget(SIZE, SIZE, { depthBuffer: false, stencilBuffer: false })
    material = new NodeMaterial()
    quad = new QuadMesh(material)
  }
  // vec4(x) splats a scalar to grey and leaves a vec4 alone; .xyz then drops
  // alpha. Alpha is forced opaque or a dim scalar reads back transparent. The
  // scene renders in linear space, so the thumbnail is display-encoded here —
  // without it every pass reads as near-black.
  const linear = vec3(vec4(node as never).xyz).max(vec3(0))
  ;(material as NodeMaterial & { fragmentNode?: unknown }).fragmentNode = vec4(pow(linear, vec3(1 / 2.2)), 1)
  material!.needsUpdate = true
  const previous = renderer.getRenderTarget()
  const previousMRT = renderer.getMRT?.()
  try {
    renderer.setMRT?.(null)
    renderer.setRenderTarget(target)
    // Submit synchronously. Never yield with the shared renderer redirected.
    quad!.render(renderer as never)
  } finally {
    renderer.setRenderTarget(previous)
    renderer.setMRT?.(previousMRT)
  }
  const pixels = new Uint8Array(await renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE))
  if (requests.get(key) !== node) return
  // Trust the buffer over the request: a padded readback has a wider stride.
  const stride = Math.max(SIZE, Math.floor(pixels.length / 4 / SIZE))
  frames.set(key, { width: SIZE, height: SIZE, stride, pixels, updatedAt: performance.now() })
  bump()
}

/**
 * Runs inside the frame loop only. Redirecting the shared renderer at an
 * arbitrary time wedges the device: the depth buffer and the colour attachments
 * end up from different frames and every later submit is rejected.
 */
function tick() {
  const now = performance.now()
  if (inFlight || !requests.size || now - lastAt < INTERVAL) return
  const keys = [...requests.keys()].filter(key => !failed.has(key))
  if (!keys.length) return
  lastAt = now
  cursor = (cursor + 1) % keys.length
  const key = keys[cursor]
  const node = requests.get(key)
  if (!node) return
  inFlight = true
  void capture(key, node)
    .catch(() => failed.add(key))
    .finally(() => {
      inFlight = false
    })
}

export const nodePreviews = {
  /** Call once per frame, from inside the render loop. */
  tick,
  /** Ask for a thumbnail of this compiled node. Re-requesting the same node is free. */
  request(key: string, node: unknown) {
    if (node == null || requests.get(key) === node) return
    requests.set(key, node)
    failed.delete(key)
  },
  /** Drop everything not in `keys` — nodes that are gone, or a closed panel. */
  keepOnly(keys: readonly string[]) {
    const wanted = new Set(keys)
    let changed = false
    for (const key of [...requests.keys()])
      if (!wanted.has(key)) {
        requests.delete(key)
        frames.delete(key)
        failed.delete(key)
        changed = true
      }
    if (changed) bump()
  },
  getFrames: () => snapshot,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
