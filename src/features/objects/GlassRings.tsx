import { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { BufferGeometry, Group, Mesh } from 'three'
import type { Feature } from '../../app/feature'
import { GlassMaterial, type GlassMaterialProps } from './glass/GlassMaterial'
import { glassControls } from './glass/glass-parameters'

const MODEL_URL = '/models/glass-rings.glb'
// The GLB is Draco-compressed; the decoder bundled with three is served under
// /draco/ so the scene never depends on a third-party fetch.
const DRACO_PATH = '/draco/'
const TILT_RADIANS = 1.6

// A continuous orbit that eases through the aligned pose without ever stopping:
// the speed dips towards MIN near phase 0 and rises to MAX on the far side, so
// the refraction never freezes.
const MIN_ANGULAR_SPEED = 0.3
const MAX_ANGULAR_SPEED = 8.05
const SLOW_ZONE_POWER = 0.8

export interface GlassRingsProps extends Omit<GlassMaterialProps, 'iridescenceThicknessRange'> {
  /** GLB with a `Torus` (glass) and a `Cylinder` (metal band) node. */
  url?: string
  dracoPath?: string
  /** Orbit speed multiplier; 0 parks the metal band. */
  spin?: number
  metalColor?: string
  metalRoughness?: number
  iridescenceThicknessMin?: number
  iridescenceThicknessMax?: number
  scale?: number
  position?: [number, number, number]
}

/**
 * GlassRings — v1's reference object: a glass torus with a metal band orbiting
 * through it, which makes the refraction legible — the band reads as bent and
 * colour-split wherever it passes behind the glass.
 *
 * The glass is the ported GlassMaterial: screen-space volume refraction,
 * spectral or RGB dispersion, Beer–Lambert attenuation and a backside pass,
 * sampling the captures of the surrounding <PostFX> host.
 */
export function GlassRings({
  url = MODEL_URL,
  dracoPath = DRACO_PATH,
  spin = 1,
  metalColor = '#b59d85',
  metalRoughness = 0.29,
  iridescenceThicknessMin = 100,
  iridescenceThicknessMax = 400,
  scale = 1,
  position = [0, 0, 0],
  ...glass
}: GlassRingsProps) {
  const band = useRef<Group>(null)
  const angle = useRef(0)
  const { nodes } = useGLTF(url, dracoPath) as unknown as { nodes: Record<string, Mesh<BufferGeometry>> }
  const torus = nodes.Torus
  const cylinder = nodes.Cylinder

  useFrame((_, delta) => {
    if (!band.current || spin === 0) return
    const phase = ((angle.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const slowBlend = Math.pow((Math.cos(phase) + 1) / 2, SLOW_ZONE_POWER)
    const speed = MIN_ANGULAR_SPEED + (MAX_ANGULAR_SPEED - MIN_ANGULAR_SPEED) * (1 - slowBlend)
    angle.current -= speed * delta * spin
    band.current.rotation.x = angle.current
  })

  if (!torus || !cylinder) return null
  return (
    <group name="GlassRings" rotation={[-Math.PI / 2, -0.5, 0]} scale={scale} position={position}>
      <mesh
        geometry={torus.geometry}
        position={torus.position}
        rotation={torus.rotation}
        scale={torus.scale}
        castShadow
        // The glass is hidden and restored during the backdrop capture, which
        // puts it outside the frustum test R3F would otherwise cache.
        frustumCulled={false}
        userData={{ outline: true }}
      >
        <GlassMaterial {...glass} iridescenceThicknessRange={[iridescenceThicknessMin, iridescenceThicknessMax]} />
      </mesh>

      <group ref={band}>
        <group rotation={[TILT_RADIANS, 0, 0]}>
          <mesh
            geometry={cylinder.geometry}
            position={cylinder.position}
            rotation={cylinder.rotation}
            scale={[cylinder.scale.x * 0.98, cylinder.scale.y * 1.1, cylinder.scale.z * 0.98]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial color={metalColor} metalness={1} roughness={metalRoughness} envMapIntensity={1} clearcoat={1} clearcoatRoughness={0} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL, DRACO_PATH)

export default GlassRings

/** v1's reference object, with v1's whole glass parameter set. */
export const feature: Feature = {
  id: 'object.glass-rings',
  label: 'Glass Rings',
  kind: 'scene',
  group: 'Objects',
  order: 102,
  description: 'v1 reference object: screen-space glass with dispersion and a backside pass',
  component: GlassRings,
  controls: {
    spin: { type: 'number', value: 1, min: 0, max: 3, step: 0.01, label: 'Spin', group: 'Object' },
    scale: { type: 'number', value: 1, min: 0.1, max: 5, step: 0.01, label: 'Scale', group: 'Object' },
    ...glassControls(),
    metalColor: { type: 'color', value: '#b59d85', label: 'Metal Color', group: 'Metal Band' },
    metalRoughness: { type: 'number', value: 0.29, min: 0, max: 1, step: 0.01, label: 'Metal Roughness', group: 'Metal Band' },
  },
}
