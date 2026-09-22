import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter } from 'three'
import type { Feature } from '../../app/feature'

export interface ContactShadowProps {
  opacity?: number
  /** Edge softness, 0 (hard) – 1 (very soft). */
  softness?: number
  /** Diameter in world units. */
  size?: number
  /** Height of the floor. */
  y?: number
  color?: string
}

/**
 * ContactShadow — a soft grounding shadow under the subject, drawn as a
 * radial-gradient decal. Costs nothing per frame and works on any backend;
 * use real shadows (Lighting + Ground) when the shape of the shadow matters.
 */
export function ContactShadow({ opacity = 0.5, softness = 0.6, size = 6, y = -1.13, color = '#000000' }: ContactShadowProps) {
  const texture = useMemo(() => {
    const resolution = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = resolution
    const context = canvas.getContext('2d')
    if (!context) return null
    const c = resolution / 2
    const gradient = context.createRadialGradient(c, c, 0, c, c, c)
    gradient.addColorStop(0, color)
    gradient.addColorStop(Math.max(0.02, 1 - Math.min(0.96, Math.max(0.04, softness))), color)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, resolution, resolution)
    const map = new CanvasTexture(canvas)
    map.minFilter = map.magFilter = LinearFilter
    return map
  }, [color, softness])

  useEffect(() => () => texture?.dispose(), [texture])
  if (!texture) return null

  return (
    <mesh position={[0, y, 0]} rotation-x={-Math.PI / 2} scale={[size, size, 1]} renderOrder={-1}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export default ContactShadow

export const feature: Feature = {
  id: 'scene.contact-shadow',
  label: 'Contact Shadow',
  kind: 'scene',
  group: 'Ground',
  order: 41,
  enabled: false,
  component: ContactShadow,
  controls: {
    opacity: { type: 'number', value: 0.5, min: 0, max: 1, step: 0.01 },
    softness: { type: 'number', value: 0.6, min: 0, max: 1, step: 0.01 },
    size: { type: 'number', value: 6, min: 0.5, max: 30, step: 0.1 },
    y: { type: 'number', value: -1.13, min: -5, max: 5, step: 0.01, label: 'Height' },
  },
}
