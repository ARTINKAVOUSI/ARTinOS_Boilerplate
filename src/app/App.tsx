import { useCallback, useMemo } from 'react'
import type { WebGPURenderer } from 'three/webgpu'
import type { RendererBackend } from '../features/canvas/WebGPUCanvas'
import { ToastProvider } from '../ui/Toast/Toast'
import { byKind } from './registry'
import { runtime, useRuntime } from './runtime'
import { Stage, renderFeature } from './Stage'
import { useStudio, type StudioState } from './store'
import { DockShell } from './studio/DockShell'

const appFeatures = byKind('app')
const overlays = byKind('overlay')
const selectFeatures = (state: StudioState) => state.features

/** The 3D view plus the DOM overlays that sit on it. Rendered inside the dock's locked viewport. */
function Viewport() {
  const states = useStudio(selectFeatures)
  const stats = useRuntime()
  const onReady = useCallback((instance: WebGPURenderer, backend: RendererBackend) => runtime.setRenderer(instance, backend), [])
  const stage = useMemo(() => <Stage onReady={onReady} />, [onReady])
  const renderer = runtime.getRenderer()
  const huds = overlays
    .filter(overlay => states[overlay.id]?.enabled)
    .map(overlay => renderFeature(overlay, states[overlay.id], { renderer, backend: stats.backend }))
  return (
    <>
      {stage}
      {huds}
    </>
  )
}

/**
 * The application: the MetaBlock dock around the viewport, with app-level
 * features (inputs) mounted beside it. Features and panels arrive through
 * their registries, so this file never changes when either is added or removed.
 */
export function App() {
  const states = useStudio(selectFeatures)
  const services = useMemo(() => appFeatures.filter(feature => states[feature.id]?.enabled).map(feature => renderFeature(feature, states[feature.id])), [states])
  const viewport = useMemo(() => <Viewport />, [])
  return (
    <ToastProvider>
      <DockShell viewport={viewport} />
      {services}
    </ToastProvider>
  )
}
