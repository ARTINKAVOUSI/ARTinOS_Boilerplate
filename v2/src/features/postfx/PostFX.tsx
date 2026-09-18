import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type DependencyList, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { RenderPipeline, type Camera, type Object3D, type Scene, type WebGPURenderer } from 'three/webgpu'
import { packNormalToRGB, metalness, mrt, normalView, output, pass, roughness, uniform, vec2, vec4, velocity } from 'three/tsl'
import type { Feature } from '../../app/feature'
import { pipelineStages, type PipelineStage } from '../../app/pipeline-stages'

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
export type PassAttachment = 'normal' | 'velocity' | 'packedNormal' | 'metalRoughness'

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

class EffectRegistry {
  private entries = new Map<string, Entry>()
  private listeners = new Set<() => void>()
  private serial = 0
  revision = 0

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

function disposeChain(root: TSLNode, keep: Set<unknown>) {
  const seen = new Set<unknown>()
  root?.traverse?.((node: TSLNode) => {
    if (keep.has(node) || seen.has(node)) return
    seen.add(node)
    node.dispose?.()
  })
}

export interface PostFXProps {
  children?: ReactNode
  /** Bypass every effect without unregistering them. */
  enabled?: boolean
}

export function PostFX({ children, enabled = true }: PostFXProps) {
  const registry = useMemo(() => new EffectRegistry(), [])
  const revision = useSyncExternalStore(registry.subscribe, registry.getRevision, registry.getRevision)
  const renderer = useThree(state => (state as unknown as { renderer?: WebGPURenderer }).renderer ?? (state.gl as unknown as WebGPURenderer))
  const scene = useThree(state => state.scene)
  const camera = useThree(state => state.camera)
  const set = useThree(state => state.set) as unknown as (partial: object | ((state: Record<string, unknown>) => object)) => void

  const entries = useMemo(() => registry.list(), [registry, revision])
  const needs = new Set(enabled ? entries.flatMap(entry => entry.needs) : [])
  const needNormal = needs.has('normal') || needs.has('packedNormal')
  const needVelocity = needs.has('velocity')
  const needPacked = needs.has('packedNormal')
  const needMR = needs.has('metalRoughness')

  // The attachment layout is fixed for a pass's lifetime, so a change of layout
  // makes a new pass rather than mutating the old one.
  const base = useMemo(() => {
    const pipeline = new RenderPipeline(renderer)
    const scenePass = pass(scene, camera)
    if (needNormal || needVelocity || needMR) {
      scenePass.setMRT(
        mrt({
          output,
          ...(needNormal ? { normal: normalView } : null),
          ...(needPacked ? { packedNormal: packNormalToRGB(normalView) } : null),
          ...(needVelocity ? { velocity } : null),
          ...(needMR ? { metalRoughness: vec2(metalness, roughness) } : null),
        }),
      )
    }
    return { pipeline, scenePass }
  }, [renderer, scene, camera, needNormal, needVelocity, needPacked, needMR])

  useEffect(() => () => {
    base.scenePass.dispose()
    base.pipeline.dispose()
  }, [base])

  useEffect(() => {
    const { pipeline, scenePass } = base
    const backend = (renderer as unknown as { backend?: { isWebGLBackend?: boolean } }).backend?.isWebGLBackend ? 'webgl2' : 'webgpu'
    const beauty = scenePass.getTextureNode('output')
    let current: TSLNode = beauty
    // Every stage is published for the Graph panel's live thumbnails.
    const stages: PipelineStage[] = [{ id: 'pass:scene', label: 'Scene Pass', node: beauty }]

    if (enabled) {
      const context: Omit<PostFXBuildContext, 'input'> = {
        scenePass,
        depth: scenePass.getTextureNode('depth'),
        viewZ: scenePass.getViewZNode(),
        normal: needNormal ? scenePass.getTextureNode('normal') : null,
        velocity: needVelocity ? scenePass.getTextureNode('velocity') : null,
        packedNormal: needPacked ? scenePass.getTextureNode('packedNormal') : null,
        metalRoughness: needMR ? scenePass.getTextureNode('metalRoughness') : null,
        scene,
        camera,
        renderer,
        backend,
      }
      for (const entry of entries) {
        if (entry.webgpuOnly && backend !== 'webgpu') {
          console.info(`[postfx] ${entry.id} needs WebGPU and is skipped on WebGL2.`)
          continue
        }
        try {
          current = entry.build({ ...context, input: current }) ?? current
          stages.push({ id: entry.id, label: entry.id, node: current })
        } catch (error) {
          // One broken effect never takes the frame down with it.
          console.error(`[postfx] ${entry.id} failed to build and was skipped.`, error)
        }
      }
      for (const attachment of ['depth', 'normal', 'velocity', 'metalRoughness'] as const) {
        const node = context[attachment]
        if (node) stages.push({ id: `pass:${attachment}`, label: attachment, node })
      }
    }

    const outputNode = current === beauty ? beauty : vec4(current.rgb, beauty.a)
    stages.push({ id: 'pass:output', label: 'Canvas', node: outputNode })
    pipelineStages.publish(stages)
    pipeline.outputNode = outputNode
    pipeline.needsUpdate = true
    set({ postProcessing: pipeline })

    return () => {
      set(state => (state.postProcessing === pipeline ? { postProcessing: null } : {}))
      // The published nodes are about to be disposed, so retract them first.
      pipelineStages.publish([])
      disposeChain(outputNode, new Set([scenePass, beauty]))
    }
  }, [base, entries, enabled, renderer, scene, camera, set, needNormal, needVelocity, needPacked, needMR])

  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>
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
