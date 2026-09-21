import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { InspectorBase, type WebGPURenderer } from 'three/webgpu'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import type { Feature } from '../../app/feature'

export interface ThreeInspectorProps {
  /** Open the full panel; otherwise only the compact toggle button shows. */
  open?: boolean
}

interface ProfilerLike {
  panel: HTMLElement
  togglePanel: () => void
}

/**
 * ThreeInspector — three.js's official WebGPU Inspector (performance,
 * memory, node viewer, console) attached to the canvas renderer.
 * GPU timings need the `timestamp-query` feature; without it the CPU side
 * still works. Mount inside the canvas.
 */
export function ThreeInspector({ open = false }: ThreeInspectorProps) {
  const renderer = useThree(state => (state as unknown as { renderer?: WebGPURenderer }).renderer ?? (state.gl as unknown as WebGPURenderer))
  const [inspector, setInspector] = useState<Inspector | null>(null)

  useEffect(() => {
    const instance = new Inspector()
    // Assigning attaches it and turns on GPU timestamp tracking.
    renderer.inspector = instance
    instance.init()
    setInspector(instance)
    return () => {
      instance.domElement.remove()
      renderer.inspector = new InspectorBase()
      // Timestamp queries pile up unresolved once nothing reads them.
      const backend = (renderer as unknown as { backend?: { trackTimestamp?: boolean } }).backend
      if (backend) backend.trackTimestamp = false
      setInspector(null)
    }
  }, [renderer])

  useEffect(() => {
    const profiler = (inspector as unknown as { profiler?: ProfilerLike } | null)?.profiler
    if (!profiler) return
    if (profiler.panel.classList.contains('visible') !== open) profiler.togglePanel()
  }, [inspector, open])

  return null
}

export default ThreeInspector

export const feature: Feature = {
  id: 'overlay.three-inspector',
  label: 'three.js Inspector',
  kind: 'scene',
  group: 'Diagnostics',
  order: 990,
  enabled: false,
  component: ThreeInspector,
  controls: {
    open: { type: 'boolean', value: true, label: 'Panel open' },
  },
}
