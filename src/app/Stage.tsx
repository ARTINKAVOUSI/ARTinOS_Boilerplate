import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { WebGPURenderer } from 'three/webgpu'
import { WebGPUCanvas, type RendererBackend } from '../features/canvas/WebGPUCanvas'
import type { DiscoveredFeature } from './feature'
import { FeatureBoundary } from './FeatureBoundary'
import { byKind } from './registry'
import { useFeatureState } from './store'
import { runtime } from './runtime'
import { nodePreviews } from './node-preview'
import { pipelineStages } from './pipeline-stages'
import { signalBus } from './signals'

/**
 * One feature, mounted while it is switched on and isolated from the others.
 * It reads only its own state, so dragging a slider re-renders that feature
 * alone, never the scene around it.
 */
export function FeatureMount({ feature, extra }: { feature: DiscoveredFeature; extra?: Record<string, unknown> }) {
  const state = useFeatureState(feature.id)
  if (!state?.enabled) return null
  const Component = feature.component
  // Effects take their chain position from the studio, which can reorder them.
  const order = feature.kind === 'effect' ? { order: state.order ?? feature.order } : null
  return (
    // A new values object is a new attempt after a crash.
    <FeatureBoundary id={feature.id} resetKey={state.values}>
      <Component {...state.values} {...order} {...extra} />
    </FeatureBoundary>
  )
}

/** A canvas provider (the PostFX host): always mounted, so switching it off never remounts the scene. */
function ProviderMount({ feature, children }: { feature: DiscoveredFeature; children: ReactNode }) {
  const state = useFeatureState(feature.id)
  // Attachments the Graph panel wants rendered for its previews.
  const attachments = useSyncExternalStore(pipelineStages.subscribeWanted, pipelineStages.getWanted, pipelineStages.getWanted)
  const Provider = feature.component
  return (
    <Provider {...state?.values} enabled={!!state?.enabled} attachments={attachments} onStages={pipelineStages.publish}>
      {children}
    </Provider>
  )
}

/** Hands the live scene to the app, so graphs and panels can address objects. */
function SceneProbe() {
  const scene = useThree(state => state.scene)
  // Node thumbnails capture here: inside the frame, never between frames. The
  // original runtime also published time and viewport as signals every frame.
  const started = useMemo(() => performance.now(), [])
  useFrame((frame, delta) => {
    signalBus.set('time.elapsed', (performance.now() - started) / 1000)
    signalBus.set('time.delta', delta)
    signalBus.set('viewport.aspect', frame.size.width / Math.max(1, frame.size.height))
    signalBus.set('viewport.dpr', frame.viewport.dpr)
    nodePreviews.tick()
  })
  useEffect(() => {
    runtime.setScene(scene)
    return () => runtime.setScene(null)
  }, [scene])
  return null
}

const canvasProviders = byKind('canvas-provider')
const sceneFeatures = byKind('scene')
const effectFeatures = byKind('effect')

export interface StageProps {
  onReady?: (renderer: WebGPURenderer, backend: RendererBackend) => void
}

/**
 * The 3D view: every scene feature, and every effect inside the canvas
 * providers (the PostFX pipeline). The tree is built once; each feature
 * mounts and unmounts itself as it is switched on and off.
 */
export function Stage({ onReady }: StageProps) {
  const tree = useMemo(() => {
    // Effects only exist inside the pipeline host; without it they are skipped, not broken.
    const effects = canvasProviders.some(provider => provider.id === 'postfx') ? effectFeatures : []
    let content: ReactNode = [...sceneFeatures, ...effects].map(feature => <FeatureMount key={feature.id} feature={feature} />)
    for (const provider of [...canvasProviders].reverse()) {
      content = (
        <ProviderMount key={provider.id} feature={provider}>
          {content}
        </ProviderMount>
      )
    }
    return content
  }, [])

  // No MSAA: the pipeline renders to its own targets, and temporal/SSAA passes
  // need single-sample depth. FXAA / SMAA / TRAA do the anti-aliasing.
  return (
    <WebGPUCanvas dpr={[1, 2]} antialias={false} onReady={onReady}>
      <SceneProbe />
      {tree}
    </WebGPUCanvas>
  )
}
