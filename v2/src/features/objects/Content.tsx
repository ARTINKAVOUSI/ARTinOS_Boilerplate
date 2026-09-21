import { Billboard, Html, Image, Text, Text3D } from '@react-three/drei/legacy'
import type { Feature } from '../../app/feature'

export type ContentMode = 'text' | 'text3d' | 'html' | 'image' | 'billboard'

export interface ContentProps {
  mode?: ContentMode
  /** The text shown in every mode except `image`. */
  text?: string
  /** Image URL, for `image` mode. */
  src?: string
  /** A typeface JSON font, for `text3d`. Without one, text3d falls back to flat text. */
  font?: string
  fontSize?: number
  color?: string
  position?: [number, number, number]
  center?: boolean
}

/**
 * Content — v1's content module: SDF text, extruded 3D text, an HTML label
 * pinned in the scene, an image plane, or text that always faces the camera.
 *
 * Mount inside a <Canvas>. Requires @react-three/drei (its legacy entry).
 */
export function Content({ mode = 'text', text = 'ARTINOS', src = '', font = '', fontSize = 0.35, color = '#ffffff', position = [0, 1.6, 0], center = true }: ContentProps) {
  if (mode === 'html') {
    return (
      <Html position={position} center={center}>
        <div style={{ color, font: `600 ${Math.round(fontSize * 48)}px system-ui, sans-serif`, whiteSpace: 'nowrap', textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>{text}</div>
      </Html>
    )
  }
  if (mode === 'image' && src) return <Image url={src} position={position} />
  const flat = (
    <Text position={mode === 'billboard' ? [0, 0, 0] : position} fontSize={fontSize} color={color} anchorX={center ? 'center' : 'left'} anchorY="middle">
      {text}
    </Text>
  )
  if (mode === 'billboard') return <Billboard position={position}>{flat}</Billboard>
  if (mode === 'text3d' && font) {
    return (
      <Text3D font={font} size={fontSize} height={fontSize * 0.25} position={position}>
        {text}
        <meshStandardMaterial color={color} />
      </Text3D>
    )
  }
  return flat
}

export default Content

export const feature: Feature = {
  id: 'object.content',
  label: 'Content',
  kind: 'scene',
  group: 'Objects',
  order: 64,
  enabled: false,
  description: 'Text, 3D text, an HTML label, an image or a billboard in the scene',
  component: Content,
  controls: {
    mode: { type: 'select', value: 'text', options: ['text', 'text3d', 'html', 'image', 'billboard'] },
    text: { type: 'text', value: 'ARTINOS' },
    src: { type: 'text', value: '', label: 'Image URL', placeholder: '/images/photo.jpg' },
    font: { type: 'text', value: '', label: 'Typeface font', placeholder: '/fonts/inter.typeface.json' },
    fontSize: { type: 'number', value: 0.35, min: 0.05, max: 3, step: 0.01, label: 'Size' },
    color: { type: 'color', value: '#ffffff' },
    position: { type: 'vector3', value: [0, 1.6, 0], step: 0.1 },
    center: { type: 'boolean', value: true },
  },
}
