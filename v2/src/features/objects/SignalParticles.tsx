import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points, type PointsMaterial } from 'three'
import type { Feature } from '../../app/feature'
import { useSignals } from '../input/signals'

export interface SignalParticlesProps {
  count?: number
  /** Radius of the cloud. */
  radius?: number
  size?: number
  color?: string
  /** Base rotation speed, radians per second. */
  speed?: number
  /** Signal that expands the cloud and speeds it up (0…1). */
  signal?: string
}

/** SignalParticles — a slowly turning point cloud that breathes with a live signal. */
export function SignalParticles({ count = 1800, radius = 2.8, size = 0.014, color = '#79ffe1', speed = 0.15, signal = 'audio.level' }: SignalParticlesProps) {
  const bus = useSignals()
  const points = useRef<Points>(null)
  const material = useRef<PointsMaterial>(null)
  const smoothed = useRef(0)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random())
      const a = Math.random() * Math.PI * 2
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * radius * 0.65
      positions[i * 3 + 2] = Math.sin(a) * r
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return g
  }, [count, radius])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    const p = points.current
    if (!p) return
    const target = signal ? bus.get(signal) : 0
    smoothed.current += (target - smoothed.current) * (1 - Math.exp(-6 * delta))
    const e = smoothed.current
    p.rotation.y += delta * speed * (1 + e * 3)
    p.scale.setScalar(1 + e * 0.25)
    if (material.current) material.current.opacity = 0.55 + e * 0.45
  })

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial ref={material} color={color} size={size * 10} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} />
    </points>
  )
}

export default SignalParticles

export const feature: Feature = {
  id: 'object.particles',
  label: 'Signal Particles',
  kind: 'scene',
  group: 'Objects',
  order: 101,
  enabled: false,
  component: SignalParticles,
  controls: {
    count: { type: 'number', value: 1800, min: 100, max: 50000, step: 100 },
    radius: { type: 'number', value: 2.8, min: 0.5, max: 20, step: 0.1 },
    size: { type: 'number', value: 0.014, min: 0.002, max: 0.1, step: 0.001 },
    color: { type: 'color', value: '#79ffe1' },
    speed: { type: 'number', value: 0.15, min: -2, max: 2, step: 0.01 },
    signal: { type: 'text', value: 'audio.level' },
  },
}
