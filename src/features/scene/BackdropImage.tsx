import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { SRGBColorSpace, Vector3, type Mesh, type PerspectiveCamera } from 'three'
import type { Feature } from '../../app/feature'

export interface BackdropImageProps {
  /** Any flat photo (not an equirect). */
  url?: string
  /** Distance in front of the camera. Keep it inside the far plane. */
  distance?: number
  /** Multiplies the image; darken it to sit behind the subject. */
  tint?: string
}

const FORWARD = new Vector3()

/**
 * BackdropImage — a photograph as a real, camera-locked scene backdrop,
 * cover-fitted to the view. Unlike a CSS image behind the canvas, it is inside
 * the scene, so glass refracts it and screen-space effects see it.
 */
export function BackdropImage({ url = '/backgrounds/persian-garden.png', distance = 40, tint = '#ffffff' }: BackdropImageProps) {
  const mesh = useRef<Mesh>(null)
  const source = useTexture(url)
  // Cover-fitting mutates repeat/offset, so work on a private copy of drei's cached texture.
  const texture = useMemo(() => {
    const copy = source.clone()
    copy.colorSpace = SRGBColorSpace
    return copy
  }, [source])
  const camera = useThree(state => state.camera) as PerspectiveCamera
  const size = useThree(state => state.size)

  useEffect(() => () => texture.dispose(), [texture])

  const fov = camera.fov ?? 50
  const height = 2 * Math.tan((fov * Math.PI) / 360) * distance
  const width = height * (size.width / Math.max(1, size.height))

  useEffect(() => {
    const image = texture.image as { width?: number; height?: number } | undefined
    if (!image?.width || !image?.height) return
    const imageAspect = image.width / image.height
    const planeAspect = width / height
    if (imageAspect > planeAspect) {
      texture.repeat.set(planeAspect / imageAspect, 1)
      texture.offset.set((1 - texture.repeat.x) / 2, 0)
    } else {
      texture.repeat.set(1, imageAspect / planeAspect)
      texture.offset.set(0, (1 - texture.repeat.y) / 2)
    }
    texture.needsUpdate = true
  }, [texture, width, height])

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    camera.getWorldDirection(FORWARD)
    m.position.copy(camera.position).addScaledVector(FORWARD, distance)
    m.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={mesh} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={tint} toneMapped={false} fog={false} />
    </mesh>
  )
}

export default BackdropImage

export const feature: Feature = {
  id: 'scene.backdrop',
  label: 'Backdrop Image',
  kind: 'scene',
  group: 'Atmosphere',
  order: 16,
  component: BackdropImage,
  controls: {
    url: { type: 'text', value: '/backgrounds/persian-garden.png', label: 'Image' },
    distance: { type: 'number', value: 40, min: 5, max: 400, step: 1 },
    tint: { type: 'color', value: '#ffffff' },
  },
}
