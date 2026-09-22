import type { Feature } from '../../app/feature'

export interface GroundProps {
  shape?: 'disc' | 'square'
  /** `shadow-only` is invisible except where shadows fall. */
  material?: 'matte' | 'glossy' | 'shadow-only'
  color?: string
  size?: number
  y?: number
  /** Darkness of the shadow for `shadow-only`. */
  shadowOpacity?: number
}

/** Ground — a floor that receives shadows. */
export function Ground({ shape = 'disc', material = 'matte', color = '#777876', size = 8, y = -1.15, shadowOpacity = 0.35 }: GroundProps) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={y} receiveShadow>
      {shape === 'disc' ? <circleGeometry args={[size / 2, 96]} /> : <planeGeometry args={[size, size]} />}
      {material === 'shadow-only' ? (
        <shadowMaterial opacity={shadowOpacity} transparent />
      ) : (
        <meshStandardMaterial color={color} roughness={material === 'glossy' ? 0.18 : 0.88} metalness={material === 'glossy' ? 0.2 : 0} />
      )}
    </mesh>
  )
}

export default Ground

export const feature: Feature = {
  id: 'scene.ground',
  label: 'Ground',
  kind: 'scene',
  group: 'Ground',
  order: 40,
  enabled: false,
  component: Ground,
  controls: {
    shape: { type: 'select', value: 'disc', options: ['disc', 'square'] },
    material: { type: 'select', value: 'matte', options: ['matte', 'glossy', 'shadow-only'] },
    color: { type: 'color', value: '#5d5e5c' },
    size: { type: 'number', value: 8, min: 1, max: 100, step: 0.5 },
    y: { type: 'number', value: -1.15, min: -5, max: 5, step: 0.01, label: 'Height' },
    shadowOpacity: { type: 'number', value: 0.35, min: 0, max: 1, step: 0.01, label: 'Shadow' },
  },
}
