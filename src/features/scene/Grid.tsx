import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import type { Feature } from '../../app/feature'

export interface GridProps {
  /** Width of the grid in world units. */
  size?: number
  /** Cells across. Every fifth line is a section line. */
  divisions?: number
  color?: string
  sectionColor?: string
  /** Where lines fade out, as a fraction of the radius. */
  fade?: number
  y?: number
}

/** Grid — a fading reference grid on the floor, drawn into a single texture. */
export function Grid({ size = 20, divisions = 20, color = '#858585', sectionColor = '#b0b0b0', fade = 0.9, y = -1.14 }: GridProps) {
  const texture = useMemo(() => {
    const resolution = 1024
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = resolution
    const context = canvas.getContext('2d')
    if (!context) return null
    const count = Math.max(1, Math.round(divisions))
    const step = resolution / count
    for (let i = 0; i <= count; i++) {
      const section = i % 5 === 0
      context.beginPath()
      context.strokeStyle = section ? sectionColor : color
      context.globalAlpha = section ? 0.72 : 0.38
      context.lineWidth = section ? 2 : 1
      const p = Math.round(i * step) + 0.5
      context.moveTo(p, 0)
      context.lineTo(p, resolution)
      context.moveTo(0, p)
      context.lineTo(resolution, p)
      context.stroke()
    }
    // Radial fade so the grid dissolves instead of ending at a hard edge.
    context.globalCompositeOperation = 'destination-in'
    context.globalAlpha = 1
    const c = resolution / 2
    const radius = Math.min(1, Math.max(0.05, fade))
    const gradient = context.createRadialGradient(c, c, 0, c, c, c)
    gradient.addColorStop(0, '#fff')
    gradient.addColorStop(radius * 0.6, '#fff')
    gradient.addColorStop(radius, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, resolution, resolution)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.minFilter = LinearMipmapLinearFilter
    map.anisotropy = 8
    return map
  }, [color, sectionColor, divisions, fade])

  useEffect(() => () => texture?.dispose(), [texture])
  if (!texture) return null

  return (
    <mesh position={[0, y + 0.002, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export default Grid

export const feature: Feature = {
  id: 'scene.grid',
  label: 'Grid',
  kind: 'scene',
  group: 'Ground',
  order: 42,
  enabled: false,
  component: Grid,
  controls: {
    size: { type: 'number', value: 20, min: 2, max: 200, step: 1 },
    divisions: { type: 'number', value: 20, min: 2, max: 200, step: 1 },
    color: { type: 'color', value: '#858585' },
    sectionColor: { type: 'color', value: '#b0b0b0', label: 'Sections' },
    fade: { type: 'number', value: 0.9, min: 0.05, max: 1, step: 0.01 },
    y: { type: 'number', value: -1.14, min: -5, max: 5, step: 0.01, label: 'Height' },
  },
}
