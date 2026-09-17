import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Color } from 'three'
import type { Feature } from '../../app/feature'

export interface BackgroundProps {
  color?: string
}

/** Background — a solid scene background colour. An Environment with `background` draws over it. */
export function Background({ color = '#15171a' }: BackgroundProps) {
  const scene = useThree(state => state.scene)
  useEffect(() => {
    const previous = scene.background
    const value = new Color(color)
    scene.background = value
    return () => {
      if (scene.background === value) scene.background = previous
    }
  }, [scene, color])
  return null
}

export default Background

export const feature: Feature = {
  id: 'scene.background',
  label: 'Background',
  kind: 'scene',
  group: 'Atmosphere',
  order: 15,
  component: Background,
  controls: {
    color: { type: 'color', value: '#1a1c1f' },
  },
}
