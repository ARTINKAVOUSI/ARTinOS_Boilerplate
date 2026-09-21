import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter } from 'three/webgpu'
import type { Feature } from '../../app/feature'

export type ShadowPreset = 'off' | 'hard' | 'soft' | 'contact' | 'studio' | 'cinematic'

export interface ShadowsProps {
  preset?: ShadowPreset
  /** Overrides the preset's opacity. */
  opacity?: number
  /** Overrides the preset's blur, 0–1. */
  blur?: number
  size?: number
  y?: number
  samples?: number
  focus?: number
  far?: number
  color?: string
}

const PRESETS: Record<Exclude<ShadowPreset, 'off'>, { opacity: number; blur: number }> = {
  hard: { opacity: 0.72, blur: 0.12 },
  soft: { opacity: 0.52, blur: 0.5 },
  contact: { opacity: 0.62, blur: 0.35 },
  studio: { opacity: 0.46, blur: 0.62 },
  cinematic: { opacity: 0.56, blur: 0.78 },
}

/**
 * Shadows — v1's preset ground shadow: a soft radial falloff under the scene,
 * drawn from a generated texture so it needs no shadow-map pass. Presets set
 * the opacity and blur; either can be overridden.
 *
 * Mount inside a <Canvas>.
 */
export function Shadows({ preset = 'studio', opacity, blur, size = 10, y = -1.13, samples = 32, focus = 0, far = 12, color = '#000000' }: ShadowsProps) {
  const selected = preset === 'off' ? PRESETS.studio : PRESETS[preset]
  const softness = Math.max(0.04, Math.min(0.94, blur ?? selected.blur))
  const resolution = Math.max(64, Math.min(512, 2 ** Math.ceil(Math.log2(Math.max(4, samples) * 8))))

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = resolution
    const context = canvas.getContext('2d')
    if (!context) return null
    const center = resolution / 2
    const gradient = context.createRadialGradient(center, center, Math.max(0, center * (0.08 + focus * 0.18)), center, center, center)
    gradient.addColorStop(0, color)
    gradient.addColorStop(Math.max(0.02, 1 - softness), color)
    gradient.addColorStop(1, 'transparent')
    context.fillStyle = gradient
    context.fillRect(0, 0, resolution, resolution)
    const next = new CanvasTexture(canvas)
    next.minFilter = next.magFilter = LinearFilter
    next.needsUpdate = true
    return next
  }, [color, focus, resolution, softness])

  useEffect(() => () => texture?.dispose(), [texture])
  if (preset === 'off' || !texture) return null
  const spread = size * Math.max(0.35, Math.min(2, far / 12))
  return (
    <mesh name="Shadows" position={[0, y, 0]} rotation-x={-Math.PI / 2} scale={[spread, spread, 1]} renderOrder={-1}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent opacity={opacity ?? selected.opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export default Shadows

// Opacity and blur stay props, not controls: a control always carries a value,
// which would override the preset it is meant to fall back to.
export const feature: Feature = {
  id: 'scene.shadows',
  label: 'Shadows',
  kind: 'scene',
  group: 'Ground',
  order: 73,
  enabled: false,
  description: 'Preset ground shadow: hard, soft, contact, studio, cinematic',
  component: Shadows,
  controls: {
    preset: { type: 'select', value: 'studio', options: ['off', 'hard', 'soft', 'contact', 'studio', 'cinematic'] },
    size: { type: 'number', value: 10, min: 1, max: 40, step: 0.1 },
    y: { type: 'number', value: -1.13, min: -5, max: 5, step: 0.01 },
    focus: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    far: { type: 'number', value: 12, min: 1, max: 40, step: 0.1 },
    color: { type: 'color', value: '#000000' },
  },
}
