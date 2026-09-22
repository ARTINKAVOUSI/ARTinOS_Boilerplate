import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type Points } from 'three'
import type { Feature } from '../../app/feature'

export interface StarsProps {
  count?: number
  /** Inner radius of the star shell. */
  radius?: number
  /** Thickness of the shell. */
  depth?: number
  size?: number
  color?: string
  /** Slow drift, radians per second. */
  speed?: number
}

/** Stars — a distant shell of points, for night and space scenes. */
export function Stars({ count = 1500, radius = 70, depth = 50, size = 0.08, color = '#dcecff', speed = 0.005 }: StarsProps) {
  const points = useRef<Points>(null)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = radius + Math.random() * depth
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return g
  }, [count, radius, depth])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += delta * speed
  })
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color={color} size={size} sizeAttenuation depthWrite={false} transparent opacity={0.9} fog={false} />
    </points>
  )
}

export default Stars

export const feature: Feature = {
  id: 'scene.stars',
  label: 'Stars',
  kind: 'scene',
  group: 'Atmosphere',
  order: 18,
  enabled: false,
  component: Stars,
  controls: {
    count: { type: 'number', value: 1500, min: 100, max: 20000, step: 100 },
    size: { type: 'number', value: 0.08, min: 0.01, max: 0.5, step: 0.005 },
    color: { type: 'color', value: '#dcecff' },
    speed: { type: 'number', value: 0.005, min: 0, max: 0.1, step: 0.001 },
  },
}
