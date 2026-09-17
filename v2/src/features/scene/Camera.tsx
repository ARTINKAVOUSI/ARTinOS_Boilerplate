import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { Camera as ThreeCamera } from 'three'
import type { Feature } from '../../app/feature'

export type CameraPreset = 'product' | 'front' | 'top' | 'isometric' | 'portrait' | 'wide' | 'cinematic' | 'macro'

export const cameraPresets: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  product: { position: [0, 1.4, 5.5], target: [0, 0.2, 0], fov: 45 },
  front: { position: [0, 0, 5], target: [0, 0, 0], fov: 45 },
  top: { position: [0, 7, 0.001], target: [0, 0, 0], fov: 45 },
  isometric: { position: [4, 3, 4], target: [0, 0, 0], fov: 42 },
  portrait: { position: [0, 1.6, 4.3], target: [0, 0.7, 0], fov: 38 },
  wide: { position: [0, 2, 8], target: [0, 0.2, 0], fov: 58 },
  cinematic: { position: [3.2, 1.1, 4.6], target: [0, 0.3, 0], fov: 32 },
  macro: { position: [0, 0.4, 2.2], target: [0, 0.2, 0], fov: 28 },
}

export interface CameraProps {
  preset?: CameraPreset
  projection?: 'perspective' | 'orthographic'
  /** Overrides the preset's field of view (perspective). */
  fov?: number
  /** Orthographic zoom. */
  zoom?: number
  near?: number
  far?: number
  /** Overrides the preset's position. */
  position?: [number, number, number]
  /** Overrides the preset's look-at point. */
  target?: [number, number, number]
}

/**
 * Camera — the scene's default camera, from a named framing preset. Orbit
 * controls take over the look-at once mounted; give them the same target.
 */
export function Camera({ preset = 'product', projection = 'perspective', fov, zoom = 90, near = 0.05, far = 500, position, target }: CameraProps) {
  const framing = cameraPresets[preset] ?? cameraPresets.product
  const at = target ?? framing.target
  const pos = position ?? framing.position
  const ref = useRef<ThreeCamera>(null)
  const controls = useThree(state => state.controls) as { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } | null

  // Re-aim whenever the framing changes, including any controls that own the target.
  useLayoutEffect(() => {
    ref.current?.lookAt(at[0], at[1], at[2])
    if (controls?.target) {
      controls.target.set(at[0], at[1], at[2])
      controls.update?.()
    }
  }, [at[0], at[1], at[2], pos[0], pos[1], pos[2], projection, controls])

  return projection === 'orthographic' ? (
    <OrthographicCamera ref={ref as never} makeDefault position={pos} zoom={zoom} near={near} far={far} />
  ) : (
    <PerspectiveCamera ref={ref as never} makeDefault position={pos} fov={fov ?? framing.fov} near={near} far={far} />
  )
}

export default Camera

export const feature: Feature = {
  id: 'scene.camera',
  label: 'Camera',
  kind: 'scene',
  group: 'Camera',
  order: 10,
  component: Camera,
  controls: {
    preset: { type: 'select', value: 'product', options: Object.keys(cameraPresets) },
    projection: { type: 'select', value: 'perspective', options: ['perspective', 'orthographic'] },
    fov: { type: 'number', value: 45, min: 10, max: 100, step: 1, unit: '°', label: 'FOV' },
    zoom: { type: 'number', value: 90, min: 10, max: 400, step: 1, label: 'Ortho zoom' },
  },
}
