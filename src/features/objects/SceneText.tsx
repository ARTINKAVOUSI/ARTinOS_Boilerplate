import { useEffect, useMemo } from 'react'
import { Billboard } from '@react-three/drei'
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three'
import type { Feature } from '../../app/feature'

export interface SceneTextProps {
  text?: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** Cap height in world units. */
  size?: number
  color?: string
  /** 0 is matte, above 0 glows through bloom. */
  emissive?: number
  /** Any CSS font family available to the page. */
  font?: string
  weight?: '300' | '400' | '600' | '800'
  /** Always face the camera. */
  billboard?: boolean
  opacity?: number
}

/** Pixels per world unit. High enough that the text stays sharp up close. */
const RESOLUTION = 256
const PADDING = 0.25

/**
 * SceneText — a line of text in the scene, drawn to a canvas and mapped onto a
 * plane. No font files and no extra dependencies: any CSS font the page has
 * works, and the texture is rebuilt only when the text or its styling changes.
 *
 * Mount inside a <Canvas>.
 */
export function SceneText({
  text = 'ARTINOS',
  position = [0, 1.6, 0],
  rotation = [0, 0, 0],
  size = 0.4,
  color = '#ffffff',
  emissive = 0,
  font = 'Inter, system-ui, sans-serif',
  weight = '600',
  billboard = false,
  opacity = 1,
}: SceneTextProps) {
  const drawn = useMemo(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return null
    const pixels = Math.round(RESOLUTION)
    context.font = `${weight} ${pixels}px ${font}`
    const width = Math.max(1, Math.ceil(context.measureText(text || ' ').width))
    canvas.width = Math.min(4096, width + pixels * PADDING * 2)
    canvas.height = Math.ceil(pixels * (1 + PADDING * 2))
    // Setting the size resets the context, so the font has to be applied again.
    context.font = `${weight} ${pixels}px ${font}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#ffffff'
    context.fillText(text, canvas.width / 2, canvas.height / 2)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.anisotropy = 8
    return { texture, aspect: canvas.width / canvas.height, height: canvas.height / pixels }
  }, [text, font, weight])

  useEffect(() => () => drawn?.texture.dispose(), [drawn])

  if (!drawn) return null
  const height = size * drawn.height
  const body = (
    <mesh name="SceneText" position={billboard ? [0, 0, 0] : position} rotation={billboard ? [0, 0, 0] : rotation}>
      <planeGeometry args={[height * drawn.aspect, height]} />
      <meshStandardMaterial
        map={drawn.texture}
        color={color}
        emissive={color}
        emissiveIntensity={emissive * 4}
        emissiveMap={emissive > 0 ? drawn.texture : null}
        transparent
        opacity={opacity}
        alphaMap={drawn.texture}
        side={DoubleSide}
        depthWrite={false}
        toneMapped={emissive === 0}
      />
    </mesh>
  )
  return billboard ? (
    <Billboard position={position} follow>
      {body}
    </Billboard>
  ) : (
    body
  )
}

export default SceneText

export const feature: Feature = {
  id: 'object.text',
  label: 'Text',
  kind: 'scene',
  group: 'Objects',
  order: 63,
  enabled: false,
  description: 'A line of text in the scene, optionally facing the camera',
  component: SceneText,
  controls: {
    text: { type: 'text', value: 'ARTINOS', placeholder: 'Anything' },
    position: { type: 'vector3', value: [0, 1.6, 0], step: 0.1 },
    rotation: { type: 'vector3', value: [0, 0, 0], step: 0.05 },
    size: { type: 'number', value: 0.4, min: 0.05, max: 4, step: 0.01 },
    color: { type: 'color', value: '#ffffff' },
    emissive: { type: 'number', value: 0, min: 0, max: 1, step: 0.01 },
    weight: { type: 'select', value: '600', options: ['300', '400', '600', '800'] },
    billboard: { type: 'boolean', value: false },
    opacity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
  },
}
