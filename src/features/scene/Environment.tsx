import { Environment as DreiEnvironment, Lightformer } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { EquirectangularReflectionMapping, Euler, SRGBColorSpace, TextureLoader } from 'three'
import type { Feature } from '../../app/feature'

export type EnvironmentPreset = 'studio' | 'softbox' | 'warehouse' | 'gallery' | 'image'

export interface EnvironmentProps {
  preset?: EnvironmentPreset
  /** Equirectangular image (jpg/png) for `preset="image"`. */
  image?: string
  intensity?: number
  /** Degrees around the vertical axis. */
  rotation?: number
  /** Also show the environment behind the scene. */
  background?: boolean
  /** Background blur, 0–1. */
  blur?: number
}

/** Four soft area lights baked into a cube map: reflections without an HDR download. */
function Lightformers({ preset, rotation }: { preset: EnvironmentPreset; rotation: number }) {
  const soft = preset === 'softbox'
  const warehouse = preset === 'warehouse'
  const gallery = preset === 'gallery'
  return (
    <group rotation={[0, rotation, 0]}>
      <Lightformer color={soft ? '#fff4e8' : '#ffffff'} intensity={soft ? 5 : 4} position={[0, 5, -4]} scale={[soft ? 8 : 6, soft ? 3 : 2, 1]} />
      <Lightformer color={warehouse ? '#9fc4ff' : '#d8e8ff'} intensity={warehouse ? 3 : 2} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer color={gallery ? '#ffd6ae' : '#ffffff'} intensity={gallery ? 3 : 2} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
      <Lightformer color="#ffffff" intensity={1.25} position={[0, -3, 4]} scale={[5, 1, 1]} />
    </group>
  )
}

/** Loads an equirect photo straight onto the scene, avoiding any loader guesswork by file type. */
function ImageEnvironment({ image, intensity, rotation, background, blur }: Required<Omit<EnvironmentProps, 'preset'>>) {
  const scene = useThree(state => state.scene)
  useEffect(() => {
    let disposed = false
    const previous = { environment: scene.environment, background: scene.background }
    const texture = new TextureLoader().load(image, () => {
      if (disposed) return
      scene.environment = texture
      if (background) scene.background = texture
    })
    texture.mapping = EquirectangularReflectionMapping
    texture.colorSpace = SRGBColorSpace
    return () => {
      disposed = true
      if (scene.environment === texture) scene.environment = previous.environment
      if (scene.background === texture) scene.background = previous.background
      texture.dispose()
    }
  }, [scene, image, background])

  useEffect(() => {
    scene.environmentIntensity = intensity
    scene.backgroundIntensity = intensity
    scene.backgroundBlurriness = blur
    scene.environmentRotation = new Euler(0, rotation, 0)
    scene.backgroundRotation = new Euler(0, rotation, 0)
  }, [scene, intensity, blur, rotation])

  return null
}

/**
 * Environment — image-based lighting and reflections. The procedural presets
 * need no files; `image` uses any equirectangular photo.
 */
export function Environment({ preset = 'studio', image = '/hdr/persianbeauty.png', intensity = 1, rotation = 0, background = false, blur = 0.1 }: EnvironmentProps) {
  const radians = (rotation * Math.PI) / 180
  if (preset === 'image') {
    return <ImageEnvironment image={image} intensity={intensity} rotation={radians} background={background} blur={blur} />
  }
  return (
    <DreiEnvironment background={background} backgroundBlurriness={blur} resolution={256} environmentIntensity={intensity}>
      <Lightformers preset={preset} rotation={radians} />
    </DreiEnvironment>
  )
}

export default Environment

export const feature: Feature = {
  id: 'scene.environment',
  label: 'Environment',
  kind: 'scene',
  group: 'Atmosphere',
  order: 20,
  component: Environment,
  controls: {
    preset: { type: 'select', value: 'image', options: ['studio', 'softbox', 'warehouse', 'gallery', 'image'] },
    image: { type: 'text', value: '/hdr/persianbeauty.png' },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    rotation: { type: 'number', value: 0, min: -180, max: 180, step: 1, unit: '°' },
    background: { type: 'boolean', value: false, label: 'Show' },
    blur: { type: 'number', value: 0.1, min: 0, max: 1, step: 0.01 },
  },
}
