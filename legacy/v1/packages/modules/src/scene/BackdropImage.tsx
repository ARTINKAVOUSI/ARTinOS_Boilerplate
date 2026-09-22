import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { SRGBColorSpace, Vector3, type Mesh } from 'three'

const FORWARD = new Vector3()
const POSITION = new Vector3()

export interface BackdropImageProps {
  /** Image URL. Any flat photo — this is not an equirect environment. */
  url: string
  /** How far in front of the camera the plane sits. Only matters relative to the far plane. */
  distance?: number
  /** Multiplies the image. Lower it to sit the backdrop behind the subject tonally. */
  tint?: string
  /** Renders the plane into the transmission backdrop only, hidden from the beauty pass. */
  backdropOnly?: boolean
  /** Called with the loaded, cover-fitted texture so a glass material can refract the same image. */
  onTexture?: (texture: any) => void
}

/**
 * A flat photograph as a real scene backdrop, camera-locked and sized to cover the frustum.
 *
 * three's WebGPU renderer will not take a flat 2D image as `scene.background` — that path accepts
 * only a colour, a cube map or an equirect, and a node background has its UVs overridden with the
 * sphere direction. A CSS image behind a transparent canvas has the opposite problem: the renderer
 * cannot see it, so transmissive and reflective materials refract nothing and read as black.
 *
 * This puts the picture *in* the scene, which is what glass, mirrors and screen-space effects
 * actually need. The plane tracks the camera so it always fills the view, and the texture is
 * cover-fitted rather than stretched.
 */
export function BackdropImage({ url, distance = 40, tint = '#ffffff', backdropOnly = false, onTexture }: BackdropImageProps) {
  const mesh = useRef<Mesh>(null)
  const source = useTexture(url)
  // Cover fitting belongs to this instance, not Drei's shared cached image.
  const texture = useMemo(() => source.clone(), [source])
  const camera = useThree((state: any) => state.camera)
  const size = useThree((state: any) => state.size)

  useEffect(() => { texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; onTexture?.(texture) }, [texture, onTexture])
  useEffect(() => () => { onTexture?.(null); texture.dispose() }, [texture, onTexture])

  // Frustum footprint at `distance`, so the plane always covers the view exactly.
  const [width, height] = useMemo(() => {
    const fov = ((camera.fov ?? 50) * Math.PI) / 180
    if (camera.isOrthographicCamera) return [(camera.right-camera.left)/camera.zoom, (camera.top-camera.bottom)/camera.zoom]
    const h = 2 * Math.tan(fov / 2) * distance / (camera.zoom || 1)
    return [h * (camera.aspect || size.width / size.height), h]
  }, [camera.fov, camera.aspect, camera.zoom, camera.left, camera.right, camera.top, camera.bottom, distance, size.width, size.height])

  // Cover-fit: crop the overflowing axis instead of squashing the picture.
  useEffect(() => {
    const image: any = texture.image
    if (!image?.width || !image?.height) return
    const imageAspect = image.width / image.height
    const planeAspect = width / height
    texture.offset.set(0, 0)
    if (imageAspect > planeAspect) {
      texture.repeat.set(planeAspect / imageAspect, 1)
      texture.offset.set((1 - texture.repeat.x) / 2, 0)
    } else {
      texture.repeat.set(1, imageAspect / planeAspect)
      texture.offset.set(0, (1 - texture.repeat.y) / 2)
    }
  }, [texture, width, height])

  useFrame(() => {
    if (!mesh.current) return
    camera.getWorldDirection(FORWARD)
    POSITION.copy(camera.position).addScaledVector(FORWARD, distance)
    mesh.current.position.copy(POSITION)
    mesh.current.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh
      ref={mesh}
      // Drawn first so everything else composites over it, and never a shadow catcher.
      renderOrder={-1000}
      frustumCulled={false}
      userData={backdropOnly ? { transmissionBackdropOnly: true } : undefined}
    >
      <planeGeometry args={[width, height]} />
      {/* Writes depth so it counts as an opaque object to any pass that separates opaque from
          transparent — a backdrop that skips depth is invisible to those passes. */}
      <meshBasicMaterial map={texture} color={tint} toneMapped={false} />
    </mesh>
  )
}

export default BackdropImage
