import { useCallback, useMemo, useState } from 'react'
import type { WebGPURenderer } from 'three/webgpu'
import type { RendererBackend } from '../features/canvas/WebGPUCanvas'
import { ToastProvider } from '../ui/Toast/Toast'
import { byKind } from './registry'
import { Stage, renderFeature } from './Stage'
import { useStudio, type StudioState } from './store'
import { Studio } from './studio/Studio'

const appFeatures = byKind('app')
const overlays = byKind('overlay')
const selectFeatures = (state: StudioState) => state.features

/**
 * The application: the stage, app-level features (inputs), overlays and the
 * studio. Every feature arrives through the registry, so
 * this file never changes when features are added or removed.
 */
export function App() {
  const states = useStudio(selectFeatures)
  const [renderer, setRenderer] = useState<{ instance: WebGPURenderer; backend: RendererBackend } | null>(null)
  const onReady = useCallback((instance: WebGPURenderer, backend: RendererBackend) => setRenderer({ instance, backend }), [])

  const stage = useMemo(() => <Stage onReady={onReady} />, [onReady])

  // App-level features sit beside the stage, so switching one never remounts the canvas.
  const services = useMemo(() => appFeatures.filter(feature => states[feature.id]?.enabled).map(feature => renderFeature(feature, states[feature.id])), [states])
  const huds = useMemo(
    () =>
      overlays
        .filter(overlay => states[overlay.id]?.enabled)
        .map(overlay => renderFeature(overlay, states[overlay.id], { renderer: renderer?.instance ?? null, backend: renderer?.backend ?? null })),
    [states, renderer],
  )

  return (
    <ToastProvider>
      {stage}
      {services}
      {huds}
      <Studio />
    </ToastProvider>
  )
}
