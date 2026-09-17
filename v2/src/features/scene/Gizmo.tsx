import { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import type { Feature } from '../../app/feature'

export interface GizmoProps {
  /** Name of the object to manipulate. */
  target?: string
  mode?: 'translate' | 'rotate' | 'scale'
  space?: 'world' | 'local'
  size?: number
  /** Snap increment. 0 is free movement. */
  snap?: number
}

/**
 * Gizmo — a translate / rotate / scale manipulator on a named scene object.
 *
 * The gizmo follows the object, including when the feature that owns it
 * remounts, and suspends the camera controls while you drag so the two do not
 * fight. It owns the controls it creates and detaches them on unmount.
 *
 * Mount inside a <Canvas>.
 */
export function Gizmo({ target = '', mode = 'translate', space = 'world', size = 0.8, snap = 0 }: GizmoProps) {
  const { scene, camera, gl, controls } = useThree()
  const [object, setObject] = useState<Object3D | null>(null)

  // The object may mount after this feature, or be replaced when its own
  // feature re-renders, so look it up on an interval rather than once.
  useEffect(() => {
    if (!target) {
      setObject(null)
      return
    }
    const find = () => {
      const found = scene.getObjectByName(target) ?? null
      setObject(current => (current === found ? current : found))
    }
    find()
    const timer = setInterval(find, 500)
    return () => clearInterval(timer)
  }, [scene, target])

  useEffect(() => {
    if (!object) return
    const gizmo = new TransformControls(camera, gl.domElement)
    gizmo.attach(object)
    gizmo.setMode(mode)
    gizmo.setSpace(space)
    gizmo.setSize(size)
    gizmo.setTranslationSnap(snap || null)
    gizmo.setRotationSnap(snap ? (snap * Math.PI) / 8 : null)
    gizmo.setScaleSnap(snap || null)
    // The controls object is not an Object3D; its helper is what the scene draws.
    const helper = gizmo.getHelper()
    scene.add(helper)

    const orbit = controls as unknown as { enabled?: boolean } | null
    const onDragging = (event: { value: boolean }) => {
      if (orbit && 'enabled' in orbit) orbit.enabled = !event.value
    }
    gizmo.addEventListener('dragging-changed', onDragging as never)

    return () => {
      gizmo.removeEventListener('dragging-changed', onDragging as never)
      if (orbit && 'enabled' in orbit) orbit.enabled = true
      scene.remove(helper)
      gizmo.detach()
      gizmo.dispose()
    }
  }, [object, camera, gl, scene, controls, mode, space, size, snap])

  return null
}

export default Gizmo

export const feature: Feature = {
  id: 'scene.gizmo',
  label: 'Gizmo',
  kind: 'scene',
  group: 'Camera',
  order: 44,
  enabled: false,
  description: 'Translate, rotate or scale a named object in the view',
  component: Gizmo,
  controls: {
    target: { type: 'text', value: 'GlassRings', label: 'Object name' },
    mode: { type: 'select', value: 'translate', options: ['translate', 'rotate', 'scale'] },
    space: { type: 'select', value: 'world', options: ['world', 'local'] },
    size: { type: 'number', value: 0.8, min: 0.2, max: 3, step: 0.05 },
    snap: { type: 'number', value: 0, min: 0, max: 1, step: 0.05 },
  },
}
