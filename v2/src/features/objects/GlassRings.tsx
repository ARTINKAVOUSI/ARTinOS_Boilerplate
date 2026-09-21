import { useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { BufferGeometry, Group, Mesh } from 'three'
import type { Feature } from '../../app/feature'
import { GlassMaterial, type GlassMaterialProps } from './glass/GlassMaterial'

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

/** v1's glass parameter set, with its defaults for this object. */
export const feature: Feature = {
  id: 'object.glass-rings',
  label: 'Glass Rings',
  kind: 'scene',
  group: 'Objects',
  order: 102,
  description: 'v1 reference object: screen-space glass with dispersion and a backside pass',
  component: GlassRings,
  controls: {
    spin: { type: 'number', value: 1, min: 0, max: 3, step: 0.01 },
    scale: { type: 'number', value: 1, min: 0.1, max: 5, step: 0.01 },
    // Glass
    color: { type: 'color', value: '#ffffff', label: 'Surface color' },
    transmission: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
    ior: { type: 'number', value: 1.26, min: 1, max: 2.5, step: 0.01, label: 'IOR' },
    thickness: { type: 'number', value: 0.98, min: 0, max: 5, step: 0.01 },
    roughness: { type: 'number', value: 0.05, min: 0, max: 1, step: 0.01 },
    dispersion: { type: 'number', value: 6, min: 0, max: 20, step: 0.1 },
    spectralDispersion: { type: 'boolean', value: false, label: 'Spectral dispersion' },
    anisotropicBlur: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Frost' },
    // Volume
    attenuationColor: { type: 'color', value: '#f1e2d3', label: 'Attenuation color' },
    attenuationDistance: { type: 'number', value: 8, min: 0, max: 20, step: 0.1, label: 'Attenuation distance' },
    distortion: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    distortionScale: { type: 'number', value: 0.5, min: 0, max: 2, step: 0.01, label: 'Distortion scale' },
    temporalDistortion: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Temporal distortion' },
    // Surface
    envMapIntensity: { type: 'number', value: 0.8, min: 0, max: 5, step: 0.01, label: 'Env intensity' },
    clearcoat: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { type: 'number', value: 0, min: 0, max: 1, step: 0.01, label: 'Clearcoat roughness' },
    iridescence: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    iridescenceIOR: { type: 'number', value: 1.3, min: 1, max: 2.5, step: 0.01, label: 'Film IOR' },
    iridescenceThicknessMin: { type: 'number', value: 100, min: 0, max: 1000, step: 1, label: 'Film thickness min' },
    iridescenceThicknessMax: { type: 'number', value: 400, min: 0, max: 1000, step: 1, label: 'Film thickness max' },
    metalness: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    specularIntensity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01, label: 'Reflectivity' },
    specularColor: { type: 'color', value: '#ffffff', label: 'Specular color' },
    sheen: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    sheenRoughness: { type: 'number', value: 1, min: 0, max: 1, step: 0.01, label: 'Sheen roughness' },
    sheenColor: { type: 'color', value: '#ffffff', label: 'Sheen color' },
    anisotropy: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    anisotropyRotation: { type: 'number', value: 0, min: -3.14159, max: 3.14159, step: 0.01, label: 'Anisotropy rotation' },
    // Quality
    samples: { type: 'number', value: 4, min: 1, max: 16, step: 1 },
    backside: { type: 'boolean', value: true, label: 'Backside pass' },
    backsideThickness: { type: 'number', value: 3, min: 0, max: 10, step: 0.01, label: 'Backside thickness' },
    backdropResolutionScale: { type: 'number', value: 0.85, min: 0.25, max: 1, step: 0.05, label: 'Backdrop scale' },
    backsideResolutionScale: { type: 'number', value: 0.7, min: 0.25, max: 1, step: 0.05, label: 'Clean pass scale' },
    forceSinglePass: { type: 'boolean', value: false, label: 'Force single pass' },
    // Metal band
    metalColor: { type: 'color', value: '#b59d85', label: 'Metal' },
    metalRoughness: { type: 'number', value: 0.29, min: 0, max: 1, step: 0.01, label: 'Metal roughness' },
  },
}
