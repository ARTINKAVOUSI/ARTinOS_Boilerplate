import { useEffect, useMemo } from 'react'
import { Vector3 } from 'three'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import type { Feature } from '../../app/feature'

export interface SkyProps {
  /** Sun height above the horizon, degrees. */
  elevation?: number
  /** Sun compass direction, degrees. */
  azimuth?: number
  turbidity?: number
  rayleigh?: number
  mieCoefficient?: number
  mieDirectionalG?: number
  /** Dome radius; keep it inside the camera far plane. */
  scale?: number
}

/**
 * Sky — physically based atmospheric sky (three's node-material SkyMesh), so
 * it renders on the WebGPU pipeline. Pair it with Lighting `sun`. Keep the sun
 * out of frame when Bloom is on, or it washes the image out.
 */
export function Sky({ elevation = 20, azimuth = -30, turbidity = 8, rayleigh = 2, mieCoefficient = 0.005, mieDirectionalG = 0.8, scale = 400 }: SkyProps) {
  const sky = useMemo(() => new SkyMesh(), [])
  useEffect(() => () => {
    sky.geometry.dispose()
    sky.material.dispose()
  }, [sky])

  useEffect(() => {
    const phi = ((90 - elevation) * Math.PI) / 180
    const theta = (azimuth * Math.PI) / 180
    sky.sunPosition.value.copy(new Vector3().setFromSphericalCoords(1, phi, theta))
    sky.turbidity.value = turbidity
    sky.rayleigh.value = rayleigh
    sky.mieCoefficient.value = mieCoefficient
    sky.mieDirectionalG.value = mieDirectionalG
  }, [sky, elevation, azimuth, turbidity, rayleigh, mieCoefficient, mieDirectionalG])

  return <primitive object={sky} scale={scale} />
}

export default Sky

export const feature: Feature = {
  id: 'scene.sky',
  label: 'Sky',
  kind: 'scene',
  group: 'Atmosphere',
  order: 17,
  enabled: false,
  component: Sky,
  controls: {
    elevation: { type: 'number', value: 20, min: -10, max: 90, step: 0.1, unit: '°' },
    azimuth: { type: 'number', value: -30, min: -180, max: 180, step: 1, unit: '°' },
    turbidity: { type: 'number', value: 8, min: 0, max: 20, step: 0.1 },
    rayleigh: { type: 'number', value: 2, min: 0, max: 6, step: 0.01 },
    mieCoefficient: { type: 'number', value: 0.005, min: 0, max: 0.1, step: 0.001, label: 'Mie' },
    mieDirectionalG: { type: 'number', value: 0.8, min: 0, max: 1, step: 0.01, label: 'Mie G' },
  },
}
