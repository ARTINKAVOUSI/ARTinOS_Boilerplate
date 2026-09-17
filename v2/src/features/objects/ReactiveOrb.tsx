import { Float } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, MeshPhysicalMaterial } from 'three'
import type { Feature } from '../../app/feature'
import { useSignals } from '../input/signals'

export interface ReactiveOrbProps {
  /** Signal that drives size and glow (0…1). Empty to disable. */
  signal?: string
  /** Extra constant energy, added to the signal. */
  energy?: number
  color?: string
  emissive?: string
  roughness?: number
  metalness?: number
  /** Gentle bobbing. */
  float?: boolean
  position?: [number, number, number]
}

/**
 * ReactiveOrb — a glossy sphere that swells, spins and glows with a live
 * signal (default `audio.bass`). Without any input it idles.
 */
export function ReactiveOrb({ signal = 'audio.bass', energy = 0, color = '#79ffe1', emissive = '#1c6b5a', roughness = 0.12, metalness = 0.1, float = true, position = [0, 0, 0] }: ReactiveOrbProps) {
  const bus = useSignals()
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshPhysicalMaterial>(null)
  const smoothed = useRef(0)

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const target = Math.max(0, (signal ? bus.get(signal) : 0) + energy)
    smoothed.current += (target - smoothed.current) * (1 - Math.exp(-10 * delta))
    const e = smoothed.current
    m.rotation.y += delta * (0.25 + e * 0.8)
    m.scale.setScalar(1 + e * 0.35)
    if (material.current) material.current.emissiveIntensity = 0.15 + e * 2.5
  })

  const orb = (
    <mesh ref={mesh} castShadow position={position} userData={{ outline: true }}>
      <icosahedronGeometry args={[1, 8]} />
      <meshPhysicalMaterial ref={material} color={color} emissive={emissive} roughness={roughness} metalness={metalness} clearcoat={1} clearcoatRoughness={0.08} />
    </mesh>
  )
  return float ? (
    <Float speed={1.2} rotationIntensity={0.18} floatIntensity={0.35}>
      {orb}
    </Float>
  ) : (
    orb
  )
}

export default ReactiveOrb

export const feature: Feature = {
  id: 'object.orb',
  label: 'Reactive Orb',
  kind: 'scene',
  group: 'Objects',
  order: 100,
  component: ReactiveOrb,
  controls: {
    signal: { type: 'text', value: 'audio.bass', placeholder: 'signal name' },
    energy: { type: 'number', value: 0, min: 0, max: 1.5, step: 0.01 },
    color: { type: 'color', value: '#79ffe1' },
    emissive: { type: 'color', value: '#1c6b5a' },
    roughness: { type: 'number', value: 0.12, min: 0, max: 1, step: 0.01 },
    metalness: { type: 'number', value: 0.1, min: 0, max: 1, step: 0.01 },
    float: { type: 'boolean', value: true },
  },
}
