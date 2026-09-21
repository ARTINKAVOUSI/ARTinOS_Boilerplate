import { useEffect, useMemo, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { WebGPURenderer } from 'three/webgpu'
import { WebGPUCanvas, type RendererBackend } from '../features/canvas/WebGPUCanvas'
import type { DiscoveredFeature } from './feature'
import { FeatureBoundary } from './FeatureBoundary'
import { byKind } from './registry'
import { useStudio, type FeatureState } from './store'
import { runtime } from './runtime'
import { nodePreviews } from './node-preview'
import { signalBus } from '../features/input/signals'

const selectFeatures = (state: { features: Record<string, FeatureState> }) => state.features

/** Render one feature with its current values, isolated from the others. */
export function renderFeature(feature: DiscoveredFeature, state: FeatureState | undefined, extra?: Record<string, unknown>, children?: ReactNode) {
  const Component = feature.component
  const props = { ...state?.values, ...extra }
  return (
    <FeatureBoundary key={feature.id} id={feature.id} resetKey={JSON.stringify(state?.values)}>
      <Component {...props}>{children}</Component>
    </FeatureBoundary>
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
 * The 3D view: every enabled scene feature, and every enabled effect inside
 * the canvas providers (the PostFX pipeline).
 */
export function Stage({ onReady }: StageProps) {
  const states = useStudio(selectFeatures)

  const tree = useMemo(() => {
    const on = (feature: DiscoveredFeature) => states[feature.id]?.enabled
    const scene = sceneFeatures.filter(on).map(feature => renderFeature(feature, states[feature.id]))
    // Effects only exist inside the pipeline host; without it they are skipped, not broken.
    const effects = canvasProviders.some(provider => provider.id === 'postfx')
      ? effectFeatures.filter(on).map(feature => renderFeature(feature, states[feature.id], { order: states[feature.id]?.order ?? feature.order }))
      : null

    let content: ReactNode = (
      <>
        {scene}
        {effects}
      </>
    )
    // Providers stay mounted when switched off (they get `enabled`), so the scene never remounts.
    for (const provider of [...canvasProviders].reverse()) {
      const Provider = provider.component
      content = (
        <Provider key={provider.id} {...states[provider.id]?.values} enabled={on(provider)}>
          {content}
        </Provider>
      )
    }
    return content
  }, [states])

  // No MSAA: the pipeline renders to its own targets, and temporal/SSAA passes
  // need single-sample depth. FXAA / SMAA / TRAA do the anti-aliasing.
  return (
    <WebGPUCanvas dpr={[1, 2]} antialias={false} onReady={onReady}>
      <SceneProbe />
      {tree}
    </WebGPUCanvas>
  )
}
