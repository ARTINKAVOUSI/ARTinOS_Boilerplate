import type { Feature } from '../../app/feature'

export type LightingPreset = 'studio' | 'softbox' | 'product' | 'neutral' | 'portrait' | 'dramatic' | 'sun' | 'night'

export interface LightingProps {
  preset?: LightingPreset
  /** Overall multiplier. */
  intensity?: number
  /** Key light multiplier. */
  keyLight?: number
  /** Fill light multiplier. */
  fill?: number
  /** Rim/back light multiplier. */
  rim?: number
  /** White balance of the key light, in Kelvin. */
  temperature?: number
  /** The key light casts shadows. */
  shadows?: boolean
  /** Shadow map resolution; a change rebuilds the key light. */
  shadowMapSize?: number | string
}

/** Approximate blackbody colour for a temperature in Kelvin (Tanner Helland's fit). */
export function kelvinToHex(kelvin: number) {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const hex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function KeyLight({ position, intensity, color, shadows, size }: { position: [number, number, number]; intensity: number; color: string; shadows: boolean; size: number }) {
  return (
    <directionalLight
      position={position}
      intensity={intensity}
      color={color}
      castShadow={shadows}
      shadow-mapSize={[size, size]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
      shadow-camera-far={30}
    />
  )
}

/**
 * Lighting — a complete light rig from a preset: key, fill and rim, plus
 * ambient. The key is a shadow-casting directional light, so screen-space
 * effects (God Rays, SSS) can find it.
 */
export function Lighting({ preset = 'studio', intensity = 1, keyLight = 1, fill = 1, rim = 1, temperature = 5600, shadows = true, shadowMapSize = 2048 }: LightingProps) {
  const white = kelvinToHex(temperature)
  const k = intensity * keyLight
  const f = intensity * fill
  const r = intensity * rim
  const size = Number(shadowMapSize) || 2048
  const key = (position: [number, number, number], value: number) => <KeyLight key={size} position={position} intensity={value} color={white} shadows={shadows} size={size} />

  switch (preset) {
    case 'sun':
      return (
        <>
          <hemisphereLight args={['#cfe4ff', '#5a4a3a', 0.45 * intensity]} />
          {key([6, 8, 3], 3 * k)}
        </>
      )
    case 'night':
      return (
        <>
          <ambientLight intensity={0.07 * intensity} />
          <pointLight position={[-3, 2, 2]} color="#4e72ff" intensity={8 * k} />
          <pointLight position={[3, 1, -2]} color="#ff3d88" intensity={5 * f} />
          {key([2, 6, 2], 0.25 * k)}
        </>
      )
    case 'dramatic':
      return (
        <>
          <ambientLight intensity={0.06 * intensity} />
          {key([4, 7, 4], 3.2 * k)}
          <pointLight position={[-4, 2, -2]} color="#7ab8ff" intensity={3 * f} />
          <pointLight position={[0, 3, -5]} color="#ffa66d" intensity={2.5 * r} />
        </>
      )
    case 'neutral':
      return (
        <>
          <ambientLight intensity={0.7 * intensity} />
          {key([4, 6, 5], 1.6 * k)}
        </>
      )
    case 'portrait':
      return (
        <>
          <ambientLight intensity={0.2 * intensity} />
          {key([3, 4, 4], 2.2 * k)}
          <spotLight position={[-3, 2, 3]} angle={0.9} penumbra={0.9} intensity={3 * f} />
          <pointLight position={[0, 3, -3]} intensity={2 * r} />
        </>
      )
    default: {
      const soft = preset === 'softbox' || preset === 'product'
      return (
        <>
          <ambientLight intensity={0.24 * intensity} />
          <hemisphereLight args={['#ffffff', '#444444', 0.2 * intensity]} />
          {key([4, 6, 4], (soft ? 2.2 : 2) * k)}
          <spotLight position={[-4, 2, 2]} angle={0.9} penumbra={0.95} intensity={3 * f} />
          <directionalLight position={[2, 6, -4]} intensity={1.2 * r} />
        </>
      )
    }
  }
}

export default Lighting

export const feature: Feature = {
  id: 'scene.lighting',
  label: 'Lighting',
  kind: 'scene',
  group: 'Lighting',
  order: 30,
  component: Lighting,
  controls: {
    preset: { type: 'select', value: 'studio', options: ['studio', 'softbox', 'product', 'neutral', 'portrait', 'dramatic', 'sun', 'night'] },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    keyLight: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, label: 'Key' },
    fill: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    rim: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    temperature: { type: 'number', value: 5600, min: 1800, max: 12000, step: 50, unit: 'K' },
    shadows: { type: 'boolean', value: true },
    shadowMapSize: { type: 'select', value: '2048', options: ['512', '1024', '2048', '4096'], label: 'Shadow map' },
  },
}
