import { useEffect, useMemo, useState } from 'react'
import { DoubleSide, LinearFilter, SRGBColorSpace, VideoTexture, type Texture } from 'three'
import type { Feature } from '../../app/feature'
import { useWebcamVideo } from '../../app/webcam'

export interface MediaPlaneProps {
  /** A video file to play. Empty uses the shared camera, when one is capturing. */
  src?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** Width in world units; height follows the video's aspect. */
  width?: number
  opacity?: number
  /** Always face the camera. */
  billboard?: boolean
}

/**
 * MediaPlane — shows a video, or the shared webcam, as a plane in the scene.
 *
 * With no `src` it displays whatever the Camera input is capturing, so the two
 * features share one stream. Owns its texture and disposes it on unmount.
 *
 * Mount inside a <Canvas>.
 */
export function MediaPlane({ src = '', position = [0, 1.2, -2], rotation = [0, 0, 0], width = 2.4, opacity = 1, billboard = false }: MediaPlaneProps) {
  const shared = useWebcamVideo()
  const [element, setElement] = useState<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (!src) {
      setElement(shared)
      return
    }
    const video = document.createElement('video')
    video.src = src
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    void video.play().catch(() => console.warn(`[media-plane] ${src} would not play`))
    setElement(video)
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [src, shared])

  const texture = useMemo<Texture | null>(() => {
    if (!element) return null
    const created = new VideoTexture(element)
    created.colorSpace = SRGBColorSpace
    created.minFilter = LinearFilter
    created.magFilter = LinearFilter
    return created
  }, [element])

  useEffect(() => () => texture?.dispose(), [texture])

  if (!texture || !element) return null
  const ratio = element.videoHeight && element.videoWidth ? element.videoHeight / element.videoWidth : 9 / 16
  return (
    <mesh name="MediaPlane" position={position} rotation={billboard ? [0, 0, 0] : rotation}>
      <planeGeometry args={[width, width * ratio]} />
      <meshBasicMaterial map={texture} side={DoubleSide} transparent={opacity < 1} opacity={opacity} toneMapped={false} />
    </mesh>
  )
}

export default MediaPlane

export const feature: Feature = {
  id: 'object.media-plane',
  label: 'Media Plane',
  kind: 'scene',
  group: 'Objects',
  order: 62,
  enabled: false,
  description: 'A video or the shared webcam, shown as a plane',
  component: MediaPlane,
  controls: {
    src: { type: 'text', value: '', label: 'Video URL', placeholder: 'Empty uses the camera' },
    position: { type: 'vector3', value: [0, 1.2, -2], step: 0.1 },
    rotation: { type: 'vector3', value: [0, 0, 0], step: 0.05 },
    width: { type: 'number', value: 2.4, min: 0.2, max: 12, step: 0.1 },
    opacity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
  },
}
