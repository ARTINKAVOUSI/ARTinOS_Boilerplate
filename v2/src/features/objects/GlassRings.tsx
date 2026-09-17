import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { BufferGeometry, Group, Mesh } from 'three'
import type { Feature } from '../../app/feature'

export interface GlassRingsProps {
  /** GLB with a `Torus` (glass) and a `Cylinder` (metal band) node. Draco-compressed. */
  url?: string
  /** Where the Draco decoder is served. */
  dracoPath?: string
  /** Orbit speed multiplier; 0 parks the band. */
  spin?: number
  ior?: number
  thickness?: number
  roughness?: number
  /** Glass dispersion (rainbow edges). */
  dispersion?: number
  attenuationColor?: string
  metalColor?: string
  metalRoughness?: number
  scale?: number
  position?: [number, number, number]
}

const MIN_SPEED = 0.3
const MAX_SPEED = 8
const TILT = 1.6

/**
 * GlassRings — a glass torus with a metal band orbiting through it, so the
 * refraction reads clearly. Uses three's physical transmission, which the
 * WebGPU renderer resolves natively.
 */
export function GlassRings({
  url = '/models/glass-rings.glb',
  dracoPath = '/draco/',
  spin = 1,
  ior = 1.26,
  thickness = 0.98,
  roughness = 0.05,
  dispersion = 6,
  attenuationColor = '#f1e2d3',
  metalColor = '#b59d85',
  metalRoughness = 0.29,
  scale = 1,
  position = [0, 0, 0],
}: GlassRingsProps) {
  const band = useRef<Group>(null)
  const angle = useRef(0)
  const { nodes } = useGLTF(url, dracoPath) as unknown as { nodes: Record<string, Mesh<BufferGeometry>> }
  const torus = nodes.Torus
  const cylinder = nodes.Cylinder

  // Eases through the aligned pose without ever stopping, so the refraction never freezes.
  useFrame((_, delta) => {
    if (!band.current || spin === 0) return
    const phase = ((angle.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const slow = Math.pow((Math.cos(phase) + 1) / 2, 0.8)
    angle.current -= (MIN_SPEED + (MAX_SPEED - MIN_SPEED) * (1 - slow)) * delta * spin
    band.current.rotation.x = angle.current
  })

  if (!torus || !cylinder) return null
  return (
    <group name="GlassRings" rotation={[-Math.PI / 2, -0.5, 0]} scale={scale} position={position}>
      <mesh geometry={torus.geometry} position={torus.position} rotation={torus.rotation} scale={torus.scale} castShadow userData={{ outline: true }}>
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          thickness={thickness}
          roughness={roughness}
          ior={ior}
          dispersion={dispersion}
          attenuationDistance={8}
          attenuationColor={attenuationColor}
          envMapIntensity={0.8}
        />
      </mesh>
      <group ref={band}>
        <group rotation={[TILT, 0, 0]}>
          <mesh
            geometry={cylinder.geometry}
            position={cylinder.position}
            rotation={cylinder.rotation}
            scale={[cylinder.scale.x * 0.98, cylinder.scale.y * 1.1, cylinder.scale.z * 0.98]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial color={metalColor} metalness={1} roughness={metalRoughness} clearcoat={1} clearcoatRoughness={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default GlassRings

export const feature: Feature = {
  id: 'object.glass-rings',
  label: 'Glass Rings',
  kind: 'scene',
  group: 'Objects',
  order: 102,
  component: GlassRings,
  controls: {
    spin: { type: 'number', value: 1, min: 0, max: 3, step: 0.01 },
    ior: { type: 'number', value: 1.26, min: 1, max: 2.4, step: 0.01, label: 'IOR' },
    thickness: { type: 'number', value: 0.98, min: 0, max: 5, step: 0.01 },
    roughness: { type: 'number', value: 0.05, min: 0, max: 1, step: 0.01 },
    dispersion: { type: 'number', value: 6, min: 0, max: 20, step: 0.1 },
    attenuationColor: { type: 'color', value: '#f1e2d3', label: 'Tint' },
    metalColor: { type: 'color', value: '#b59d85', label: 'Metal' },
    scale: { type: 'number', value: 1, min: 0.1, max: 5, step: 0.01 },
  },
}
