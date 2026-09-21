import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Feature } from '../../app/feature'
import { GlassMaterial, type GlassMaterialProps } from './glass/GlassMaterial'
import { glassControls } from './glass/glass-parameters'

export interface GlassMeshProps extends Omit<GlassMaterialProps, 'iridescenceThicknessRange'> {
  iridescenceThicknessMin?: number
  iridescenceThicknessMax?: number
  shape?: 'sphere' | 'box' | 'torus' | 'knot' | 'cylinder'
  position?: [number, number, number]
  scale?: number
  /** Turns per minute around Y. 0 holds still. */
  spin?: number
}

/**
 * GlassMesh — the ported GlassMaterial around a primitive, v1's reusable glass
 * object. Refraction samples the captures of the surrounding <PostFX> host, so
 * put it in a scene with something behind it to bend.
 *
 * Mount inside a <Canvas>, under <PostFX> for the backdrop and backside passes.
 */
export function GlassMesh({ shape = 'sphere', position = [0, 1, 0], scale = 1, spin = 4, iridescenceThicknessMin = 100, iridescenceThicknessMax = 400, ...glass }: GlassMeshProps) {
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (mesh.current && spin) mesh.current.rotation.y += (spin / 60) * Math.PI * 2 * delta
  })

  return (
    // Hidden and restored during the backdrop capture, so R3F's cached frustum test must not apply.
    <mesh name="GlassMesh" ref={mesh} position={position} scale={scale} castShadow frustumCulled={false}>
      {shape === 'sphere' && <sphereGeometry args={[0.6, 96, 64]} />}
      {shape === 'box' && <boxGeometry args={[0.9, 0.9, 0.9, 8, 8, 8]} />}
      {shape === 'torus' && <torusGeometry args={[0.55, 0.22, 64, 128]} />}
      {shape === 'knot' && <torusKnotGeometry args={[0.45, 0.16, 180, 32]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[0.45, 0.45, 1, 64]} />}
      <GlassMaterial {...glass} iridescenceThicknessRange={[iridescenceThicknessMin, iridescenceThicknessMax]} />
    </mesh>
  )
}

export default GlassMesh

export const feature: Feature = {
  id: 'object.glass-mesh',
  label: 'Glass Mesh',
  kind: 'scene',
  group: 'Objects',
  order: 61,
  enabled: false,
  description: 'The ported glass material on a primitive',
  component: GlassMesh,
  controls: {
    shape: { type: 'select', value: 'sphere', options: ['sphere', 'box', 'torus', 'knot', 'cylinder'], label: 'Shape', group: 'Object' },
    position: { type: 'vector3', value: [0, 1, 0], step: 0.1, label: 'Position', group: 'Object' },
    scale: { type: 'number', value: 1, min: 0.1, max: 4, step: 0.01, label: 'Scale', group: 'Object' },
    spin: { type: 'number', value: 4, min: 0, max: 60, step: 0.5, unit: 'rpm', label: 'Spin', group: 'Object' },
    // GlassMaterial's own defaults, as v1's GlassMesh used them.
    ...glassControls({ ior: 1.5, thickness: 0.35, dispersion: 5, anisotropicBlur: 0.1, attenuationColor: '#ffffff', attenuationDistance: 0, envMapIntensity: 0.5, samples: 6, backsideThickness: 0.35 }),
  },
}
