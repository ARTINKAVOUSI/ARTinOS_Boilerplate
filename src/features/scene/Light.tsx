import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { IESLoader } from 'three/addons/loaders/IESLoader.js'
import { IESSpotLight, LightProbe, SphericalHarmonics3 } from 'three/webgpu'
import type { Feature } from '../../app/feature'

export type LightType = 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot' | 'rect-area' | 'ies' | 'probe'

export interface LightProps {
  type?: LightType
  color?: string
  /** Hemisphere lights only: the colour from below. */
  groundColor?: string
  intensity?: number
  position?: [number, number, number]
  castShadow?: boolean
  /** Point, spot and IES: 0 is infinite reach. */
  distance?: number
  decay?: number
  /** Spot and IES cone, radians. */
  angle?: number
  penumbra?: number
  /** Rect-area size. */
  width?: number
  height?: number
  shadowMapSize?: number
  visible?: boolean
  layers?: number
  /** An .ies photometric profile. Required for `type: 'ies'`. */
  iesUrl?: string
}

/**
 * Light — one light of any kind, ported from v1's Light module: ambient,
 * hemisphere, directional, point, spot, rect-area, IES-profile spot and a light
 * probe, all with the same props.
 *
 * Mount inside a <Canvas>.
 */
export function Light({
  type = 'directional',
  color = '#ffffff',
  groundColor = '#667788',
  intensity = 1,
  position = [3, 5, 4],
  castShadow = false,
  distance = 0,
  decay = 2,
  angle = Math.PI / 3,
  penumbra = 0.25,
  width = 4,
  height = 4,
  shadowMapSize = 2048,
  visible = true,
  layers = 0,
  iesUrl = '',
}: LightProps) {
  const mapSize: [number, number] = [shadowMapSize, shadowMapSize]
  if (type === 'ies') {
    if (!iesUrl) return null
    return <IESLight url={iesUrl} color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} angle={angle} penumbra={penumbra} layers={layers} visible={visible} />
  }
  if (type === 'probe') return visible ? <ProbeLight intensity={intensity} layers={layers} /> : null
  if (type === 'ambient') return <ambientLight name="Light" color={color} intensity={intensity} visible={visible} layers={layers} />
  if (type === 'hemisphere') return <hemisphereLight name="Light" color={color} groundColor={groundColor} intensity={intensity} position={position} visible={visible} layers={layers} />
  if (type === 'point')
    return <pointLight name="Light" color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} visible={visible} layers={layers} shadow-mapSize={mapSize} />
  if (type === 'spot')
    return (
      <spotLight name="Light" color={color} intensity={intensity} position={position} castShadow={castShadow} distance={distance} decay={decay} angle={angle} penumbra={penumbra} visible={visible} layers={layers} shadow-mapSize={mapSize} />
    )
  if (type === 'rect-area') return <rectAreaLight name="Light" color={color} intensity={intensity} position={position} width={width} height={height} visible={visible} layers={layers} />
  return <directionalLight name="Light" color={color} intensity={intensity} position={position} castShadow={castShadow} visible={visible} layers={layers} shadow-mapSize={mapSize} />
}

/** A spot light shaped by an IES photometric profile. */
export function IESLight({
  url,
  color = '#ffffff',
  intensity = 1,
  position = [3, 5, 4],
  castShadow = false,
  distance = 0,
  decay = 2,
  angle = Math.PI / 3,
  penumbra = 0.25,
  visible = true,
  layers = 0,
}: { url: string } & Omit<LightProps, 'type' | 'iesUrl'>) {
  // useLoader caches the profile and owns it, so it is never disposed here.
  const map = useLoader(IESLoader, url)
  // Built once, with the profile already on it, so its first light node samples the map.
  const light = useMemo(() => {
    const created = new IESSpotLight(color, intensity, distance, angle, penumbra, decay)
    created.iesMap = map
    return created
  }, [])
  const [x, y, z] = position
  // Sync only: disposing here would tear the light down on every prop change.
  useEffect(() => {
    light.name = 'Light'
    light.iesMap = map
    light.color.set(color)
    light.intensity = intensity
    light.distance = distance
    light.decay = decay
    light.angle = angle
    light.penumbra = penumbra
    light.position.set(x, y, z)
    light.castShadow = castShadow
    light.visible = visible
    light.layers.set(layers)
  }, [light, map, color, intensity, distance, decay, angle, penumbra, x, y, z, castShadow, visible, layers])
  useEffect(() => () => light.dispose(), [light])
  return <primitive object={light} />
}

/** An empty light probe; fill its coefficients to light from an environment. */
export function ProbeLight({ intensity = 1, layers = 0 }: { intensity?: number; layers?: number }) {
  // Created once: a new probe on every intensity step would rebuild every material's lighting.
  const probe = useMemo(() => new LightProbe(new SphericalHarmonics3(), intensity), [])
  useEffect(() => {
    probe.name = 'Light'
    probe.intensity = intensity
    probe.layers.set(layers)
  }, [probe, intensity, layers])
  useEffect(() => () => probe.dispose(), [probe])
  return <primitive object={probe} />
}

export default Light

export const feature: Feature = {
  id: 'scene.light',
  label: 'Light',
  kind: 'scene',
  group: 'Lighting',
  order: 56,
  enabled: false,
  description: 'One extra light of any kind: directional, point, spot, rect-area, IES profile, probe',
  component: Light,
  controls: {
    type: { type: 'select', value: 'directional', options: ['ambient', 'hemisphere', 'directional', 'point', 'spot', 'rect-area', 'ies', 'probe'] },
    color: { type: 'color', value: '#ffffff' },
    groundColor: { type: 'color', value: '#667788', label: 'Ground color' },
    intensity: { type: 'number', value: 1, min: 0, max: 20, step: 0.01 },
    position: { type: 'vector3', value: [3, 5, 4], step: 0.1 },
    castShadow: { type: 'boolean', value: false, label: 'Cast shadow' },
    distance: { type: 'number', value: 0, min: 0, max: 100, step: 0.1 },
    decay: { type: 'number', value: 2, min: 0, max: 4, step: 0.01 },
    angle: { type: 'number', value: 1.047, min: 0.05, max: 1.57, step: 0.01 },
    penumbra: { type: 'number', value: 0.25, min: 0, max: 1, step: 0.01 },
    width: { type: 'number', value: 4, min: 0.1, max: 20, step: 0.1 },
    height: { type: 'number', value: 4, min: 0.1, max: 20, step: 0.1 },
    shadowMapSize: { type: 'number', value: 2048, min: 256, max: 4096, step: 256, label: 'Shadow map' },
    iesUrl: { type: 'text', value: '', label: 'IES profile', placeholder: '/ies/profile.ies' },
  },
}
