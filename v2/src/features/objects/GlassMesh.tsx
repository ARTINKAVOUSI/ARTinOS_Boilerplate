import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Feature } from '../../app/feature'

export interface GlassMeshProps {
  shape?: 'sphere' | 'box' | 'torus' | 'knot' | 'cylinder'
  position?: [number, number, number]
  scale?: number
  /** Turns per minute around Y. 0 holds still. */
  spin?: number
  /** Index of refraction: 1.33 water, 1.5 glass, 2.4 diamond. */
  ior?: number
  /** Wall thickness the light travels through. */
  thickness?: number
  /** 0 is polished, 1 is frosted. */
  roughness?: number
  /** Splits refraction into colours. */
  dispersion?: number
  /** Colour picked up along the light's path through the volume. */
  attenuationColor?: string
  attenuationDistance?: number
  /** A thin polished coat over the surface. */
  clearcoat?: number
  envMapIntensity?: number
}

/**
 * GlassMesh — a physically shaded transmissive solid: refraction, dispersion,
 * volume attenuation and a clearcoat, on any of five primitives.
 *
 * Transmission needs something behind it to refract, so put it in a scene with
 * an environment or a backdrop. Mount inside a <Canvas>.
 */
export function GlassMesh({
  shape = 'sphere',
  position = [0, 1, 0],
  scale = 1,
  spin = 4,
  ior = 1.5,
  thickness = 0.6,
  roughness = 0.05,
  dispersion = 2,
  attenuationColor = '#bfe6ff',
  attenuationDistance = 8,
  clearcoat = 1,
  envMapIntensity = 0.9,
}: GlassMeshProps) {
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (mesh.current && spin) mesh.current.rotation.y += (spin / 60) * Math.PI * 2 * delta
  })

  return (
    <mesh name="GlassMesh" ref={mesh} position={position} scale={scale} castShadow>
      {shape === 'sphere' && <sphereGeometry args={[0.6, 96, 64]} />}
      {shape === 'box' && <boxGeometry args={[0.9, 0.9, 0.9, 8, 8, 8]} />}
      {shape === 'torus' && <torusGeometry args={[0.55, 0.22, 64, 128]} />}
      {shape === 'knot' && <torusKnotGeometry args={[0.45, 0.16, 180, 32]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[0.45, 0.45, 1, 64]} />}
      <meshPhysicalMaterial
        color="#ffffff"
        transmission={1}
        thickness={thickness}
        roughness={roughness}
        ior={ior}
        dispersion={dispersion}
        attenuationColor={attenuationColor}
        attenuationDistance={attenuationDistance}
        clearcoat={clearcoat}
        clearcoatRoughness={0}
        envMapIntensity={envMapIntensity}
      />
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
  description: 'Refraction, dispersion and volume attenuation on a primitive',
  component: GlassMesh,
  controls: {
    shape: { type: 'select', value: 'sphere', options: ['sphere', 'box', 'torus', 'knot', 'cylinder'] },
    position: { type: 'vector3', value: [0, 1, 0], step: 0.1 },
    scale: { type: 'number', value: 1, min: 0.1, max: 4, step: 0.01 },
    spin: { type: 'number', value: 4, min: 0, max: 60, step: 0.5, unit: 'rpm' },
    ior: { type: 'number', value: 1.5, min: 1, max: 2.6, step: 0.01 },
    thickness: { type: 'number', value: 0.6, min: 0, max: 4, step: 0.01 },
    roughness: { type: 'number', value: 0.05, min: 0, max: 1, step: 0.01 },
    dispersion: { type: 'number', value: 2, min: 0, max: 10, step: 0.05 },
    attenuationColor: { type: 'color', value: '#bfe6ff' },
    attenuationDistance: { type: 'number', value: 8, min: 0.1, max: 40, step: 0.1 },
    clearcoat: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
    envMapIntensity: { type: 'number', value: 0.9, min: 0, max: 3, step: 0.01 },
  },
}
