import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type DependencyList, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline, UnsignedByteType, type Camera, type Object3D, type Scene, type WebGPURenderer } from 'three/webgpu'
import { diffuseColor, packNormalToRGB, metalness, mrt, normalView, output, pass, roughness, uniform, vec2, vec4, velocity } from 'three/tsl'
import type { Feature } from '../../app/feature'

/**
 * PostFX — the render pipeline host.
 *
 * Mount once inside a WebGPU canvas. Effect components below it register a
 * `build` function; the host chains them in `order` over a single scene pass
 * and hands the result to R3F as its post-processing pipeline. With no effects
 * registered the scene renders straight through.
 *
 * An effect is any component that calls `usePostFXEffect`. Each effect in
 * `./effects/` is one self-contained file that needs only this one.
 *
 * A component that needs extra scene passes of its own (the glass material's
 * backdrop capture) registers them with `usePostFXPass`; this file knows
 * nothing about any particular one.
 *
 *   <PostFX>
 *     <Bloom strength={0.8} />
 *     <Vignette />
 *   </PostFX>
 *
 * Requires: three >= 0.185 (WebGPURenderer, TSL), @react-three/fiber >= 10.
 */

// TSL nodes are loosely typed upstream; the pipeline treats them opaquely.
export type TSLNode = any

/** Extra scene-pass attachments an effect reads. Requested only while such an effect is active. */
export type PassAttachment = 'normal' | 'velocity' | 'packedNormal' | 'metalRoughness' | 'diffuse'

export interface PostFXBuildContext {
  /** The image so far — the scene pass, or the previous effect's output. */
  input: TSLNode
  scenePass: TSLNode
  depth: TSLNode
  viewZ: TSLNode
  normal: TSLNode | null
  velocity: TSLNode | null
  packedNormal: TSLNode | null
  /** r = metalness, g = roughness. */
  metalRoughness: TSLNode | null
  /** Surface albedo (the material's diffuse colour, unlit): what bounce light is multiplied by. */
  diffuse: TSLNode | null
  scene: Scene
  camera: Camera
  renderer: WebGPURenderer
  backend: 'webgpu' | 'webgl2'
}

export interface PostFXEffectOptions {
  enabled?: boolean
  /** Position in the chain. Lower runs first. Scene-replacing passes use < 50. */
  order?: number
  needs?: PassAttachment[]
  /** Skip the effect (and log once) on the WebGL2 fallback. */
  webgpuOnly?: boolean
  /** Return the new image node, or null to pass the input through. */
  build: (context: PostFXBuildContext) => TSLNode | null
}

interface Entry extends Required<Omit<PostFXEffectOptions, 'enabled'>> {
  id: string
  serial: number
}

/** What the host hands a pass provider when it builds the scene pass. */
export interface PostFXPassContext {
  scenePass: TSLNode
  scene: Scene
  camera: Camera
  renderer: WebGPURenderer
}

/**
 * Extra scene passes a component needs beside the effect chain. `create` runs
 * each time the host builds its scene pass and may wrap that pass; `value` is
 * what `usePostFXPass` returns to every component registered under the id.
 * Define the provider at module level so every instance shares one.
 */
export interface PostFXPassProvider<T = unknown> {
  create(context: PostFXPassContext): { value: T; update?(delta: number): void; dispose?(): void }
}

/** One stage of the built pipeline: its id, a label, and the TSL node it outputs. */
export interface PostFXStage {
  id: string
  label: string
  node: TSLNode
  /** Scene-pass attachments an effect's build read: depth, normal, velocity, packedNormal, metalRoughness, diffuse. */
  reads?: readonly string[]
}

/** Context keys that are scene-pass attachments, and the attachment each one is. */
const ATTACHMENT_OF: Record<string, string> = { depth: 'depth', viewZ: 'depth', normal: 'normal', velocity: 'velocity', packedNormal: 'packedNormal', metalRoughness: 'metalRoughness', diffuse: 'diffuse' }
/** Effects already reported as skipped on WebGL2, so a rebuild does not repeat it. */
const reportedSkips = new Set<string>()

class EffectRegistry {
  private entries = new Map<string, Entry>()
  private passes = new Map<string, { provider: PostFXPassProvider; users: number }>()
  private listeners = new Set<() => void>()
  private serial = 0
  revision = 0

  addPass(id: string, provider: PostFXPassProvider) {
    const current = this.passes.get(id)
    if (current) current.users++
    else {
      this.passes.set(id, { provider, users: 1 })
      this.emit()
    }
    return () => {
      const entry = this.passes.get(id)
      if (!entry || --entry.users > 0) return
      this.passes.delete(id)
      this.emit()
    }
  }

  passList() {
    return [...this.passes.entries()].map(([id, { provider }]) => ({ id, provider })).sort((a, b) => a.id.localeCompare(b.id))
  }

  set(id: string, options: Omit<Entry, 'id' | 'serial'>) {
    const entry = { ...options, id, serial: ++this.serial }
    this.entries.set(id, entry)
    this.emit()
    return () => {
      if (this.entries.get(id)?.serial !== entry.serial) return
      this.entries.delete(id)
      this.emit()
    }
  }

  list() {
    return [...this.entries.values()].sort((a, b) => a.order - b.order || a.serial - b.serial)
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRevision = () => this.revision

  private emit() {
    this.revision++
    this.listeners.forEach(listener => listener())
  }
}

const RegistryContext = createContext<EffectRegistry | null>(null)

const PassValuesContext = createContext<ReadonlyMap<string, unknown> | null>(null)

/**
 * Ask the nearest <PostFX> for extra scene passes. Returns the provider's
 * value once the host has built them, and null before that or outside a host.
 * Every component using the same id shares one set of passes; they are
 * released when the last one unmounts.
 */
export function usePostFXPass<T>(id: string, provider: PostFXPassProvider<T>, enabled = true): T | null {
  const registry = useContext(RegistryContext)
  const values = useContext(PassValuesContext)
  useEffect(() => {
    if (!registry || !enabled) return
    return registry.addPass(id, provider as PostFXPassProvider)
  }, [registry, id, provider, enabled])
  return enabled ? ((values?.get(id) as T | undefined) ?? null) : null
}

/**
 * Register an effect with the nearest <PostFX>. `deps` lists everything the
 * build reads that is not a live uniform; changing one rebuilds the chain.
 * Values that change often should be `useUniform` nodes instead — those update
 * on the GPU without a rebuild.
 */
export function usePostFXEffect(id: string, options: PostFXEffectOptions, deps: DependencyList = []) {
  const registry = useContext(RegistryContext)
  const { enabled = true, order = 500, needs = [], webgpuOnly = false, build } = options
  useEffect(() => {
    if (!registry) {
      console.warn(`[postfx] "${id}" is not inside <PostFX>; it has no effect.`)
      return
    }
    if (!enabled) return
    return registry.set(id, { order, needs, webgpuOnly, build })
    // `build` is intentionally captured when its declared deps change.
  }, [registry, id, enabled, order, webgpuOnly, needs.join(','), ...deps])
}

/** A GPU uniform that follows `value` without rebuilding the pipeline. */
export function useUniform(value: number): TSLNode {
  const node = useMemo(() => uniform(value), [])
  node.value = value
  return node
}

/** Find the first light of a kind — the default for effects that need one (God Rays, SSS). */
export function findLight(scene: Scene, test: (object: Object3D) => boolean): Object3D | undefined {
  let found: Object3D | undefined
  scene.traverse(object => {
    if (!found && test(object)) found = object
  })
  return found
}

/**
 * Release every node a chain build created, each once. `keep` (the scene pass
 * and its attachments) belongs to the next build and is neither disposed nor
 * walked into.
 */
function disposeChain(root: TSLNode, keep: Set<unknown>) {
  const seen = new Set<unknown>(keep)
  const pending: TSLNode[] = root ? [root] : []
  while (pending.length) {
    const node = pending.pop()
    if (!node || seen.has(node)) continue
    seen.add(node)
    // An RTT node (convertToTexture) owns a full-size render target and its quad's
    // material, which dispose() leaves allocated. (The quad's geometry is shared.)
    if (node.isRTTNode) {
      node.renderTarget?.dispose?.()
      node._quadMesh?.material?.dispose?.()
    }
    node.dispose?.()
    if (typeof node.getChildren === 'function') for (const child of node.getChildren()) pending.push(child)
  }
}

export interface PostFXProps {
  children?: ReactNode
  /** Bypass every effect without unregistering them. */
  enabled?: boolean
  /** Extra attachments to render even when no effect needs them (e.g. for previews). */
  attachments?: readonly PassAttachment[]
  /** Called with every stage of the pipeline each time it is built, and with [] before it is torn down. */
  onStages?: (stages: PostFXStage[]) => void
}

export function PostFX({ children, enabled = true, attachments = [], onStages }: PostFXProps) {
  const registry = useMemo(() => new EffectRegistry(), [])
  const revision = useSyncExternalStore(registry.subscribe, registry.getRevision, registry.getRevision)
  const renderer = useThree(state => (state as unknown as { renderer?: WebGPURenderer }).renderer ?? (state.gl as unknown as WebGPURenderer))
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const set = useThree(state => state.set) as unknown as (partial: object | ((state: Record<string, unknown>) => object)) => void

  const entries = useMemo(() => registry.list(), [registry, revision])
  const passes = useMemo(() => registry.passList(), [registry, revision])
  const passKey = passes.map(entry => entry.id).join()
  const webgpu = !(renderer as unknown as { backend?: { isWebGLBackend?: boolean } }).backend?.isWebGLBackend
  // An effect skipped on WebGL2 does not get its attachments rendered either.
  const needs = new Set(enabled ? [...entries.flatMap(entry => (entry.webgpuOnly && !webgpu ? [] : entry.needs)), ...attachments] : [])
  const needNormal = needs.has('normal') || needs.has('packedNormal')
  const needVelocity = needs.has('velocity')
  const needPacked = needs.has('packedNormal')
  const needMR = needs.has('metalRoughness')
  const needDiffuse = needs.has('diffuse')

  // The attachment layout is fixed for a pass's lifetime, so a change of layout
  // makes a new pass rather than mutating the old one.
  const base = useMemo(() => {
    const pipeline = new RenderPipeline(renderer)
    const scenePass = pass(scene, camera)
    if (needNormal || needVelocity || needMR || needDiffuse) {
      scenePass.setMRT(
        mrt({
          output,
          ...(needNormal ? { normal: normalView } : null),
          ...(needPacked ? { packedNormal: packNormalToRGB(normalView) } : null),
          ...(needVelocity ? { velocity } : null),
          ...(needMR ? { metalRoughness: vec2(metalness, roughness) } : null),
          ...(needDiffuse ? { diffuse: diffuseColor } : null),
        }),
      )
      // Albedo lives in 0–1, so eight bits carry it at a quarter of the bandwidth.
      if (needDiffuse) scenePass.getTexture('diffuse').type = UnsignedByteType
    }
    scenePass.name = 'Scene / Beauty'
    // Registered pass providers may wrap the scene pass as it is built.
    const instances = passes.map(({ id, provider }) => ({ id, ...provider.create({ scenePass, scene, camera, renderer }) }))
    const values = new Map<string, unknown>(instances.map(instance => [instance.id, instance.value]))
    return { pipeline, scenePass, instances, values }
    // passKey stands in for `passes`: the same ids mean the same providers.
  }, [renderer, scene, camera, needNormal, needVelocity, needPacked, needMR, needDiffuse, passKey])

  useEffect(() => () => {
    for (const instance of base.instances) instance.dispose?.()
    base.scenePass.dispose()
    base.pipeline.dispose()
  }, [base])

  useFrame((_, delta) => {
    for (const instance of base.instances) instance.update?.(delta)
  })

  const onStagesRef = useRef(onStages)
  onStagesRef.current = onStages

  useEffect(() => {
    const { pipeline, scenePass } = base
    const backend = webgpu ? 'webgpu' : 'webgl2'
    const beauty = scenePass.getTextureNode('output')
    let current: TSLNode = beauty
    // Every stage is reported, e.g. for live thumbnails of each pass.
    const stages: PostFXStage[] = [{ id: 'pass:scene', label: 'Scene Pass', node: beauty }]
    // The scene pass and its attachments outlive this chain; everything else the effects built goes with it.
    const keep = new Set<unknown>([scenePass, beauty])

    if (enabled) {
      const context: Omit<PostFXBuildContext, 'input'> = {
        scenePass,
        depth: scenePass.getTextureNode('depth'),
        viewZ: scenePass.getViewZNode(),
        normal: needNormal ? scenePass.getTextureNode('normal') : null,
        velocity: needVelocity ? scenePass.getTextureNode('velocity') : null,
        packedNormal: needPacked ? scenePass.getTextureNode('packedNormal') : null,
        metalRoughness: needMR ? scenePass.getTextureNode('metalRoughness') : null,
        diffuse: needDiffuse ? scenePass.getTextureNode('diffuse') : null,
        scene,
        camera,
        renderer,
        backend,
      }
      for (const node of [context.depth, context.viewZ, context.normal, context.velocity, context.packedNormal, context.metalRoughness, context.diffuse]) if (node) keep.add(node)
      for (const entry of entries) {
        if (entry.webgpuOnly && backend !== 'webgpu') {
          if (!reportedSkips.has(entry.id)) console.info(`[postfx] ${entry.id} needs WebGPU and is skipped on WebGL2.`)
          reportedSkips.add(entry.id)
          continue
        }
        try {
          // Note which attachments the build reads, so a pipeline view can wire them.
          const read = new Set<string>()
          const watched = new Proxy({ ...context, input: current } as PostFXBuildContext, {
            get(target, key) {
              if (typeof key === 'string' && key in ATTACHMENT_OF) read.add(ATTACHMENT_OF[key])
              return target[key as keyof PostFXBuildContext]
            },
          })
          const built = entry.build(watched)
          if (!built) continue
          current = built
          stages.push({ id: entry.id, label: entry.id, node: current, reads: [...read] })
        } catch (error) {
          // One broken effect never takes the frame down with it.
          console.error(`[postfx] ${entry.id} failed to build and was skipped.`, error)
        }
      }
      for (const attachment of ['depth', 'normal', 'velocity', 'metalRoughness', 'diffuse'] as const) {
        const node = context[attachment]
        if (node) stages.push({ id: `pass:${attachment}`, label: attachment, node })
      }
    }

    const outputNode = current === beauty ? beauty : vec4(current.rgb, beauty.a)
    stages.push({ id: 'pass:output', label: 'Canvas', node: outputNode })
    onStagesRef.current?.(stages)
    pipeline.outputNode = outputNode
    pipeline.needsUpdate = true
    set({ postProcessing: pipeline })

    return () => {
      set(state => (state.postProcessing === pipeline ? { postProcessing: null } : {}))
      // The published nodes are about to be disposed, so retract them first.
      onStagesRef.current?.([])
      disposeChain(outputNode, keep)
    }
  }, [base, entries, enabled, webgpu, scene, camera, set, needNormal, needVelocity, needPacked, needMR, needDiffuse])

  return (
    <RegistryContext.Provider value={registry}>
      <PassValuesContext.Provider value={base.values}>{children}</PassValuesContext.Provider>
    </RegistryContext.Provider>
  )
}

export default PostFX

export const feature: Feature = {
  id: 'postfx',
  label: 'Post Processing',
  kind: 'canvas-provider',
  group: 'Render',
  order: 900,
  description: 'Hosts the effect chain. Turn off to bypass every effect.',
  component: PostFX,
}
