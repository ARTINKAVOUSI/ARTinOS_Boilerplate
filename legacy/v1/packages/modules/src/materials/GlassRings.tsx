import { useRef, type ComponentProps } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { Group } from 'three'
import { GlassMaterial, type GlassMaterialProps } from './GlassMaterial'

const MODEL_URL = '/models/glass-rings.glb'
// The GLB is Draco-compressed. drei defaults to a gstatic CDN decoder; ARTINOS ships the one
// bundled with three under /draco/ instead, so the scene never depends on a third-party fetch.
const DRACO_PATH = '/draco/'
const TILT_RADIANS = 1.6

// A continuous orbit that eases through the aligned pose without ever stopping: the speed dips
// towards MIN near phase 0 and rises to MAX on the far side. A plain sine would stall at the
// turn; this keeps momentum so the refraction never freezes.
const MIN_ANGULAR_SPEED = 0.3
const MAX_ANGULAR_SPEED = 8.05
const SLOW_ZONE_POWER = 0.8

export interface GlassRingsProps extends ComponentProps<'group'> {
  /** GLB with a `Torus` (glass) and `Cylinder` (metal band) node. */
  modelUrl?: string
  /** Orbit speed multiplier; 0 parks the metal band. */
  spin?: number
  glass?: GlassMaterialProps
  /** Texture the glass refracts — pass the same one the scene backdrop plane displays. */
  backdropMap?: any
  metalColor?: string
  metalRoughness?: number
}

/**
 * The two interlocking rings from the WebGPU transmission reference: a static glass torus with
 * a metal band orbiting through it, which is what makes the refraction legible — the band reads
 * as bent and colour-split wherever it passes behind the glass.
 */
export function GlassRings({
  modelUrl = MODEL_URL,
  spin = 1,
  glass,
  backdropMap,
  metalColor = '#B59D85',
  metalRoughness = 0.29,
  ...groupProps
}: GlassRingsProps) {
  const spinRef = useRef<Group>(null)
  const angle = useRef(0)
  const { nodes } = useGLTF(modelUrl, DRACO_PATH) as any
  const torus = nodes.Torus
  const cylinder = nodes.Cylinder

  useFrame((_state, delta) => {
    if (!spinRef.current || spin === 0) return
    const phase = ((angle.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const slowBlend = Math.pow((Math.cos(phase) + 1) / 2, SLOW_ZONE_POWER)
    const speed = MIN_ANGULAR_SPEED + (MAX_ANGULAR_SPEED - MIN_ANGULAR_SPEED) * (1 - slowBlend)
    angle.current -= speed * delta * spin
    spinRef.current.rotation.x = angle.current
  })

  return (
    <group rotation={[-Math.PI / 2, -0.5, 0]} {...groupProps}>
      <mesh
        geometry={torus.geometry}
        position={torus.position}
        rotation={torus.rotation}
        scale={torus.scale}
        castShadow
        // The glass is hidden and restored during the backdrop capture, which puts it outside
        // the frustum test R3F would otherwise cache.
        frustumCulled={false}
      >
        <GlassMaterial
          color="#ffffff"
          transmission={1}
          thickness={0.98}
          roughness={0.05}
          ior={1.26}
          dispersion={6}
          anisotropicBlur={0}
          attenuationDistance={8}
          attenuationColor="#F1E2D3"
          envMapIntensity={0.8}
          samples={4}
          backside
          backsideThickness={3}
          backdropResolutionScale={0.85}
          backsideResolutionScale={0.7}
          backdropMap={backdropMap}
          {...glass}
        />
      </mesh>

      <group ref={spinRef}>
        <group rotation={[TILT_RADIANS, 0, 0]}>
          <mesh
            geometry={cylinder.geometry}
            position={cylinder.position}
            rotation={cylinder.rotation}
            scale={[cylinder.scale.x * 0.98, cylinder.scale.y * 1.1, cylinder.scale.z * 0.98]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={metalColor}
              metalness={1}
              roughness={metalRoughness}
              envMapIntensity={1}
              clearcoat={1}
              clearcoatRoughness={0}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL, DRACO_PATH)

export default GlassRings
