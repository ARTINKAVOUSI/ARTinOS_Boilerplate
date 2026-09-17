import type { Feature } from '../../app/feature'

export interface FogProps {
  /** `linear` fades between near and far; `exponential` thickens with distance. */
  mode?: 'linear' | 'exponential'
  color?: string
  near?: number
  far?: number
  /** Exponential density. */
  density?: number
}

/** Fog — distance haze. Match `color` to the background for a seamless horizon. */
export function Fog({ mode = 'linear', color = '#1a1c1f', near = 8, far = 30, density = 0.04 }: FogProps) {
  return mode === 'exponential' ? <fogExp2 attach="fog" args={[color, density]} /> : <fog attach="fog" args={[color, near, far]} />
}

export default Fog

export const feature: Feature = {
  id: 'scene.fog',
  label: 'Fog',
  kind: 'scene',
  group: 'Atmosphere',
  order: 25,
  enabled: false,
  component: Fog,
  controls: {
    mode: { type: 'select', value: 'linear', options: ['linear', 'exponential'] },
    color: { type: 'color', value: '#1a1c1f' },
    near: { type: 'number', value: 8, min: 0, max: 100, step: 0.1 },
    far: { type: 'number', value: 30, min: 1, max: 300, step: 0.5 },
    density: { type: 'number', value: 0.04, min: 0, max: 0.3, step: 0.001 },
  },
}
