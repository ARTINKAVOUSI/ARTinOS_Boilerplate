import { Environment as DreiEnvironment, Lightformer } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
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
function ImageEnvironment({ image, intensity, rotation, background, blur, onError }: Required<Omit<EnvironmentProps, 'preset'>> & { onError: () => void }) {
  const scene = useThree(state => state.scene)
  const [texture, setTexture] = useState<Texture | null>(null)

  // Loaded once per image: toggling the background must not reload the photo or regenerate the PMREM.
  useEffect(() => {
    let disposed = false
    let handedOver = false
    const loaded = new TextureLoader().load(
      image,
      () => {
        if (disposed) return
        handedOver = true
        setTexture(loaded)
      },
      undefined,
      () => {
        if (disposed) return
        console.warn(`[environment] Could not load ${image}; using the studio preset instead.`)
        onError()
      },
    )
    loaded.mapping = EquirectangularReflectionMapping
    loaded.colorSpace = SRGBColorSpace
    return () => {
      disposed = true
      // Once handed over, the effects below unassign it before it is disposed.
      if (handedOver) setTexture(current => (current === loaded ? null : current))
      else loaded.dispose()
    }
  }, [image])

  useEffect(() => {
    if (!texture) return
    const previous = scene.environment
    scene.environment = texture
    return () => {
      if (scene.environment === texture) scene.environment = previous
    }
  }, [scene, texture])

  useEffect(() => {
    if (!background || !texture) return
    const previous = scene.background
    scene.background = texture
    return () => {
      if (scene.background === texture) scene.background = previous
    }
  }, [scene, texture, background])

  // Cleanups run in declaration order, so this frees the photo after both slots let go of it.
  useEffect(() => () => texture?.dispose(), [texture])

  // Declared before the sync below, so it records what the scene had before this mounted.
  useEffect(() => {
    const previous = {
      environmentIntensity: scene.environmentIntensity,
      backgroundIntensity: scene.backgroundIntensity,
      backgroundBlurriness: scene.backgroundBlurriness,
      environmentRotation: scene.environmentRotation.clone(),
      backgroundRotation: scene.backgroundRotation.clone(),
    }
    return () => {
      scene.environmentIntensity = previous.environmentIntensity
      scene.backgroundIntensity = previous.backgroundIntensity
      scene.backgroundBlurriness = previous.backgroundBlurriness
      scene.environmentRotation.copy(previous.environmentRotation)
      scene.backgroundRotation.copy(previous.backgroundRotation)
    }
  }, [scene])

  useEffect(() => {
    scene.environmentIntensity = intensity
    scene.backgroundIntensity = intensity
    scene.backgroundBlurriness = blur
    // The renderer reads these Eulers every frame, so set them in place.
    scene.environmentRotation.set(0, rotation, 0)
    scene.backgroundRotation.set(0, rotation, 0)
  }, [scene, intensity, blur, rotation])

  return null
}

/**
 * Environment — image-based lighting and reflections. The procedural presets
 * need no files; `image` uses an equirectangular photo you supply (the
 * Library's Assets can hand it one). Without a photo, or when it fails to
 * load, the studio preset lights the scene instead.
 */
export function Environment({ preset = 'studio', image = '', intensity = 1, rotation = 0, background = false, blur = 0.1 }: EnvironmentProps) {
  const radians = (rotation * Math.PI) / 180
  const [failed, setFailed] = useState<string | null>(null)
  if (preset === 'image' && image && failed !== image) {
    return <ImageEnvironment image={image} intensity={intensity} rotation={radians} background={background} blur={blur} onError={() => setFailed(image)} />
  }
  return (
    <DreiEnvironment background={background} backgroundBlurriness={blur} resolution={256} environmentIntensity={intensity}>
      <Lightformers preset={preset === 'image' ? 'studio' : preset} rotation={radians} />
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
  description: 'Image-based lighting and reflections from a preset or equirect photo',
  component: Environment,
  controls: {
    preset: { type: 'select', value: 'studio', options: ['studio', 'softbox', 'warehouse', 'gallery', 'image'] },
    image: { type: 'text', value: '', placeholder: 'Equirect photo URL, for the image preset' },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01 },
    rotation: { type: 'number', value: 0, min: -180, max: 180, step: 1, unit: '°' },
    background: { type: 'boolean', value: false, label: 'Show' },
    blur: { type: 'number', value: 0.1, min: 0, max: 1, step: 0.01 },
  },
}
