import { CameraControls, MapControls, OrbitControls, TrackballControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { Feature } from '../../app/feature'

export type ControlsMode = 'orbit' | 'map' | 'trackball' | 'camera' | 'none'

export interface ControlsProps {
  mode?: ControlsMode
  /** Point the camera orbits around. Leave unset when a Camera feature aims the controls. */
  target?: [number, number, number]
  damping?: boolean
  autoRotate?: boolean
  autoRotateSpeed?: number
  enablePan?: boolean
  enableZoom?: boolean
  minDistance?: number
  maxDistance?: number
  /** Lowest the camera may go, in degrees from straight up (90 = horizon). */
  maxPolarAngle?: number
}

/**
 * Controls — mouse/touch camera navigation. `orbit` for inspecting an object,
 * `map` for top-down scenes, `trackball` for free rotation, `camera` for
 * smooth animated transitions (camera-controls).
 */
export function Controls({
  mode = 'orbit',
  target,
  damping = true,
  autoRotate = false,
  autoRotateSpeed = 1,
  enablePan = true,
  enableZoom = true,
  minDistance = 0.5,
  maxDistance = 60,
  maxPolarAngle = 180,
}: ControlsProps) {
  const domElement = useThree(state => state.gl?.domElement) as HTMLElement | undefined
  if (mode === 'none' || !domElement) return null
  if (mode === 'map') {
    return <MapControls makeDefault domElement={domElement} target={target} enableDamping={damping} minDistance={minDistance} maxDistance={maxDistance} />
  }
  if (mode === 'trackball') return <TrackballControls makeDefault domElement={domElement} target={target} minDistance={minDistance} maxDistance={maxDistance} />
  if (mode === 'camera') return <CameraControls makeDefault domElement={domElement} minDistance={minDistance} maxDistance={maxDistance} />
  return (
    <OrbitControls
      makeDefault
      domElement={domElement}
      target={target}
      enableDamping={damping}
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      enablePan={enablePan}
      enableZoom={enableZoom}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={(maxPolarAngle * Math.PI) / 180}
    />
  )
}

export default Controls

export const feature: Feature = {
  id: 'scene.controls',
  label: 'Navigation',
  kind: 'scene',
  group: 'Camera',
  order: 11,
  component: Controls,
  controls: {
    mode: { type: 'select', value: 'orbit', options: ['orbit', 'map', 'trackball', 'camera', 'none'] },
    autoRotate: { type: 'boolean', value: false, label: 'Auto-rotate' },
    autoRotateSpeed: { type: 'number', value: 1, min: -10, max: 10, step: 0.1, label: 'Rotate speed' },
    damping: { type: 'boolean', value: true },
    enablePan: { type: 'boolean', value: true, label: 'Pan' },
    maxPolarAngle: { type: 'number', value: 88, min: 10, max: 180, step: 1, unit: '°', label: 'Max tilt' },
    minDistance: { type: 'number', value: 1.5, min: 0, max: 20, step: 0.1, label: 'Min dist' },
    maxDistance: { type: 'number', value: 25, min: 1, max: 200, step: 1, label: 'Max dist' },
  },
}
