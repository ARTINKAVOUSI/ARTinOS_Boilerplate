import { useCallback, useMemo } from 'react'
import type { WebGPURenderer } from 'three/webgpu'
import type { RendererBackend } from '../features/canvas/WebGPUCanvas'
import { ToastProvider } from '../ui/Toast/Toast'
import { byKind } from './registry'
import { runtime, useRuntime, type RuntimeSnapshot } from './runtime'
import { FeatureMount, Stage } from './Stage'
import { DockShell } from './studio/DockShell'

const appFeatures = byKind('app')
const overlays = byKind('overlay')
const selectBackend = (snapshot: RuntimeSnapshot) => snapshot.backend

/** The 3D view plus the DOM overlays that sit on it. Rendered inside the dock's locked viewport. */
function Viewport() {
  // The renderer is set once, together with the backend, so this re-renders only then.
  const backend = useRuntime(selectBackend)
  const renderer = runtime.getRenderer()
  const onReady = useCallback((instance: WebGPURenderer, kind: RendererBackend) => runtime.setRenderer(instance, kind), [])
  const stage = useMemo(() => <Stage onReady={onReady} />, [onReady])
  const extra = useMemo(() => ({ renderer, backend }), [renderer, backend])
  return (
    <>
      {stage}
      {overlays.map(overlay => (
        <FeatureMount key={overlay.id} feature={overlay} extra={extra} />
      ))}
    </>
  )
}

/**
 * The application: the MetaBlock dock around the viewport, with app-level
 * features (inputs) mounted beside it. Features and panels arrive through
 * their registries, so this file never changes when either is added or removed.
 */
export function App() {
  const viewport = useMemo(() => <Viewport />, [])
  return (
    <ToastProvider>
      <DockShell viewport={viewport} />
      {appFeatures.map(feature => (
        <FeatureMount key={feature.id} feature={feature} />
      ))}
    </ToastProvider>
  )
}
