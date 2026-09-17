import { useEffect, useState } from 'react'
import { Data3DTexture, LinearFilter, RGBAFormat, UnsignedByteType, type Texture } from 'three/webgpu'
import { texture3D } from 'three/tsl'
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js'
import { LUTCubeLoader } from 'three/addons/loaders/LUTCubeLoader.js'
import type { Feature } from '../../../app/feature'
import { usePostFXEffect, useUniform } from '../PostFX'

/** A gentle teal-shadow / warm-highlight grade, so the effect works without a file. */
function builtInGrade(size = 32) {
  const data = new Uint8Array(size * size * size * 4)
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const R = r / (size - 1), G = g / (size - 1), B = b / (size - 1)
    const l = 0.2126 * R + 0.7152 * G + 0.0722 * B
    const shadow = 1 - l, light = l
    const i = (b * size * size + g * size + r) * 4
    data[i] = Math.round(Math.min(1, R * 1.02 + light * 0.05 - shadow * 0.03) * 255)
    data[i + 1] = Math.round(Math.min(1, G + shadow * 0.02) * 255)
    data[i + 2] = Math.round(Math.min(1, B * 0.96 + shadow * 0.06 - light * 0.04) * 255)
    data[i + 3] = 255
  }
  const map = new Data3DTexture(data, size, size, size)
  map.format = RGBAFormat
  map.type = UnsignedByteType
  map.minFilter = map.magFilter = LinearFilter
  map.unpackAlignment = 1
  map.needsUpdate = true
  return map
}

export interface ColorGradeProps {
  id?: string
  enabled?: boolean
  /** Position in the effect chain; lower runs first. */
  order?: number
  /** Blend with the original. */
  intensity?: number
  /** URL of a .cube LUT. Empty uses the built-in grade. */
  url?: string
}

/**
 * Color Grade — applies a 3D lookup table.
 *
 * Pass a `.cube` file as `url`; without one a built-in warm/teal grade is generated.
 *
 * Mount inside <PostFX>.
 */
export function ColorGrade({ id = 'lut3d', enabled = true, order = 450, intensity = 1, url = '' }: ColorGradeProps) {
  const [lut, setLut] = useState<Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    let current: Texture | null = null
    if (!url) {
      current = builtInGrade()
      setLut(current)
    } else {
      new LUTCubeLoader().loadAsync(url).then(result => {
        if (cancelled) return result.texture3D.dispose()
        current = result.texture3D
        setLut(current)
      }, error => console.warn('[postfx] LUT failed to load', error))
    }
    return () => {
      cancelled = true
      current?.dispose()
    }
  }, [url])
  const intensityU = useUniform(intensity)
  usePostFXEffect(id, {
    enabled,
    order,
    webgpuOnly: true,
    build: ({ input }) => (lut ? lut3D(input, texture3D(lut), (lut.image as { width: number }).width, intensityU) : null),
  }, [url, lut])
  return null
}

export default ColorGrade

export const feature: Feature = {
  id: 'effect.lut3d',
  label: 'Color Grade (3D LUT)',
  kind: 'effect',
  category: 'color',
  cost: 'medium',
  order: 450,
  enabled: false,
  webgpuOnly: true,
  component: ColorGrade,
  controls: {
    intensity: { type: 'number', value: 1, min: 0, max: 1, step: 0.01 },
    url: { type: 'text', value: '' },
  },
}
