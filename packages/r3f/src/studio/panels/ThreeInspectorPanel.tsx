import { useEffect, useRef } from 'react'
import { Box } from 'lucide-react'
import { useArtinosRuntime, type ThreeInspectorController } from '@artinos/runtime'
import { useResources } from '../hooks'

/** Hosts the official Three renderer inspector, attached to the one shared renderer. */
export function ThreeInspectorPanel() {
  const runtime = useArtinosRuntime()
  useResources()
  const inspector = runtime.resources.get<ThreeInspectorController>('three.inspector')
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = host.current
    if (!target || !inspector) return
    inspector.attach(target)
    return () => inspector.detach(target)
  }, [inspector])

  if (!inspector) {
    return (
      <div className="artinos-inspector-unavailable">
        <Box />
        <span>
          <b>Inspector unavailable</b>
          <small>Enable Three Inspector in the renderer configuration.</small>
        </span>
      </div>
    )
  }

  return <div ref={host} className="artinos-inspector-dock" aria-label="Three.js renderer inspector" />
}
