import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { texture as textureNode, uniform, viewportSharedTexture } from 'three/tsl'
import { TRANSMISSION_BACKDROP_RESOURCE, useResource } from '@artinos/runtime'
import { buildTransmissionBackdropNode, type TransmissionUniforms } from './transmission-nodes'
export interface GlassMaterialProps {
  /** Base albedo; tints the transmitted light. */
  color?: string | THREE.Color
  /** Transmitted vs opaque, 0–1. */
  transmission?: number
  /** Optical path length through the volume. Drives refraction offset and attenuation. */
  thickness?: number
  roughness?: number
  metalness?: number
  /** Index of refraction. Air 1, water 1.33, glass 1.5. */
  ior?: number
  /** Chromatic aberration strength (per-channel IOR spread). */
  dispersion?: number
  /** Stratified spectral lobes instead of the fixed R/G/B taps. Recompiles the node graph. */
  spectralDispersion?: boolean
  /** Extra thickness smear / frost, independent of roughness. */
  anisotropicBlur?: number
  /** 3D noise bent into the refraction normal. */
  distortion?: number
  distortionScale?: number
  temporalDistortion?: number
  /** Beer–Lambert absorption tint and the distance over which it fully absorbs. */
  attenuationColor?: string | THREE.Color
  attenuationDistance?: number
  envMapIntensity?: number
  specularIntensity?: number
  specularColor?: string | THREE.Color
  sheen?: number
  sheenRoughness?: number
  sheenColor?: string | THREE.Color
  anisotropy?: number
  anisotropyRotation?: number
  iridescenceThicknessRange?: [number, number]
  forceSinglePass?: boolean
  clearcoat?: number
  clearcoatRoughness?: number
  iridescence?: number
  iridescenceIOR?: number
  /** Sample count 1–16, baked into the TSL loop. Recompiles the node graph on change. */
  samples?: number
  /** Second pass rendering back faces into the backdrop, for a true internal surface. */
  backside?: boolean
  backsideThickness?: number
  /** Resolution scale of the offscreen backdrop passes — the cheapest quality knob. */
  backdropResolutionScale?: number
  backsideResolutionScale?: number
  /** Solid fill used as the scene background while the backdrop is captured. */
  background?: string | THREE.Color
  side?: THREE.Side
  /** Use the shared scene capture for volume refraction; otherwise use native transmission. */
  screenSpaceBackdrop?: boolean
  /** Optional image fallback when no pipeline capture is mounted. */
  backdropMap?: any
}

const DEFAULTS: Required<Omit<GlassMaterialProps, 'color' | 'attenuationColor' | 'background' | 'side'>> & {
  color: string; attenuationColor: string; background: string; side: THREE.Side
} = {
  color: '#ffffff', transmission: 1, thickness: 0.35, roughness: 0.1, metalness: 0, ior: 1.5,
  dispersion: 5, spectralDispersion: false, anisotropicBlur: 0.1, distortion: 0, distortionScale: 0.5,
  temporalDistortion: 0, attenuationColor: '#ffffff', attenuationDistance: 0, envMapIntensity: 0.5,
  clearcoat: 0, clearcoatRoughness: 0, iridescence: 0, iridescenceIOR: 1.3, samples: 6,
  backside: true, backsideThickness: 0.35, backdropResolutionScale: 0.85, backsideResolutionScale: 0.7,
  specularIntensity: 1, specularColor: '#ffffff', sheen: 0, sheenRoughness: 1, sheenColor: '#ffffff',
  anisotropy: 0, anisotropyRotation: 0, iridescenceThicknessRange: [100, 400], forceSinglePass: false,
  background: '#161616', side: THREE.FrontSide, screenSpaceBackdrop: true, backdropMap: null,
}

const resolveColor = (value: any, fallback = '#ffffff') =>
  value instanceof THREE.Color ? value : new THREE.Color(value ?? fallback)

function applyProps(material: any, uniforms: any, props: Required<GlassMaterialProps>) {
  const params = uniforms.transmissionParams as TransmissionUniforms
  const featureKey = [material.clearcoat > 0, material.sheen > 0, material.iridescence > 0, material.anisotropy > 0, material.transmission > 0, material.side].join(':')

  uniforms.transmission.value = props.transmission
  params.anisotropicBlur.value = props.anisotropicBlur
  params.distortion.value = props.distortion
  params.distortionScale.value = props.distortionScale
  params.temporalDistortion.value = props.temporalDistortion
  params.attenuationDistance.value = props.attenuationDistance
  params.attenuationColor.value.set(props.attenuationColor as any)
  params.ior.value = props.ior
  params.dispersion.value = props.dispersion
  params.thickness.value = props.thickness
  params.backsideThickness.value = props.backsideThickness

  material.color.set(props.color)
  material.transmission = props.screenSpaceBackdrop ? 0 : props.transmission
  material.ior = props.ior
  material.thickness = props.thickness
  material.dispersion = props.dispersion
  material.roughness = props.roughness
  material.metalness = props.metalness
  material.clearcoat = props.clearcoat
  material.clearcoatRoughness = props.clearcoatRoughness
  material.iridescence = props.iridescence
  material.iridescenceIOR = props.iridescenceIOR
  material.attenuationDistance = props.attenuationDistance
  material.attenuationColor.set(props.attenuationColor as any)
  material.envMapIntensity = props.envMapIntensity
  material.side = props.side
  material.specularIntensity = props.specularIntensity
  material.specularColor.set(props.specularColor)
  material.sheen = props.sheen
  material.sheenRoughness = props.sheenRoughness
  material.sheenColor.set(props.sheenColor)
  material.anisotropy = props.anisotropy
  material.anisotropyRotation = props.anisotropyRotation
  material.iridescenceThicknessRange = [...props.iridescenceThicknessRange]
  material.forceSinglePass = props.forceSinglePass
  const back = material.transmissionBacksideMaterial
  if (back) {
    for (const key of ['ior', 'attenuationDistance', 'roughness', 'metalness', 'dispersion', 'clearcoat', 'clearcoatRoughness', 'iridescence', 'iridescenceIOR', 'envMapIntensity', 'specularIntensity', 'sheen', 'sheenRoughness', 'anisotropy', 'anisotropyRotation', 'forceSinglePass']) back[key] = material[key]
    back.thickness = props.backsideThickness
    back.attenuationColor.copy(material.attenuationColor)
    back.color.copy(material.color)
    back.specularColor.copy(material.specularColor)
    back.sheenColor.copy(material.sheenColor)
    back.iridescenceThicknessRange = [...material.iridescenceThicknessRange]
    back.visible = props.backside
  }

  const nextFeatureKey = [material.clearcoat > 0, material.sheen > 0, material.iridescence > 0, material.anisotropy > 0, material.transmission > 0, material.side].join(':')
  if (featureKey !== nextFeatureKey) {
    material.needsUpdate = true
    if (back) back.needsUpdate = true
  }
  material.transmissionBackdropConfig = {
    backside: props.backside,
    backsideThickness: props.backsideThickness,
    thickness: props.thickness,
    backdropResolutionScale: props.backdropResolutionScale,
    backsideResolutionScale: props.backsideResolutionScale,
    background: resolveColor(props.background),
  }
}

/**
 * Physically-shaded refractive glass for the WebGPU renderer, as an R3F material.
 *
 * ```tsx
 * <mesh>
 *   <torusGeometry args={[1, .35, 32, 64]} />
 *   <GlassMaterial ior={1.26} thickness={.98} dispersion={6} samples={4} backside />
 * </mesh>
 * ```
 *
 * Sample count and spectral mode rebuild the refraction graph. Live optical values update
 * uniforms; enabling physical lobes recompiles the material variant when needed.
 */
export const GlassMaterial = forwardRef<any, GlassMaterialProps>(function GlassMaterial(incoming, fref) {
  const renderer = useThree((state: any) => state.renderer ?? state.gl)

  const props = { ...DEFAULTS, ...incoming } as Required<GlassMaterialProps>
  // Live values are read through a ref so a slider drag never rebuilds the node graph.
  const latest = useRef(props)
  latest.current = props

  const [compiledSamples, setCompiledSamples] = useState(props.samples)
  const [compiledSpectral, setCompiledSpectral] = useState(props.spectralDispersion)

  const backdropTexture = useResource<any>(TRANSMISSION_BACKDROP_RESOURCE)
  const cleanBackdrop = useResource<any>('render.transmissionCleanBackdrop')
  const backdropTex = props.screenSpaceBackdrop ? (backdropTexture ?? props.backdropMap) : null
  const useImageBackdrop = !backdropTexture && !!props.backdropMap

  const { material, uniforms } = useMemo(() => {
    const initial = latest.current
    const uTime = uniform(0)
    const uTransmission = uniform(initial.transmission)

    const transmissionUniforms: TransmissionUniforms = {
      ior: uniform(initial.ior),
      dispersion: uniform(initial.dispersion),
      thickness: uniform(initial.thickness),
      backsideThickness: uniform(initial.backsideThickness),
      anisotropicBlur: uniform(initial.anisotropicBlur),
      distortion: uniform(initial.distortion),
      distortionScale: uniform(initial.distortionScale),
      temporalDistortion: uniform(initial.temporalDistortion),
      attenuationDistance: uniform(initial.attenuationDistance),
      attenuationColor: uniform(resolveColor(initial.attenuationColor)),
      time: uTime,
      backdropScale: uniform(new THREE.Vector2(1, 1)),
      backdropOffset: uniform(new THREE.Vector2(0, 0)),
    }

    const next = new (THREE as any).MeshPhysicalNodeMaterial({
      name: 'ArtinosGlassMaterial',
      color: resolveColor(initial.color),
      roughness: initial.roughness,
      ior: initial.ior,
      thickness: initial.thickness,
      transmission: initial.screenSpaceBackdrop ? 0 : initial.transmission,
      dispersion: initial.dispersion,
      attenuationDistance: initial.attenuationDistance,
      attenuationColor: resolveColor(initial.attenuationColor),
      envMapIntensity: initial.envMapIntensity,
      side: initial.side,
    })

    next.transmissionUniforms = transmissionUniforms
    next.thicknessNode = transmissionUniforms.thickness
    next.iorNode = transmissionUniforms.ior
    next.attenuationDistanceNode = transmissionUniforms.attenuationDistance
    next.attenuationColorNode = transmissionUniforms.attenuationColor

    next.isTransmissionGlassMaterial = initial.screenSpaceBackdrop
    next.transmissionSampleTaps = Math.min(16, Math.max(compiledSpectral ? 3 : 1, Math.round(compiledSamples))) * (compiledSpectral ? 1 : 3)
    next.transmissionSpectral = compiledSpectral
    if (initial.screenSpaceBackdrop) {
      // A pass resource is already a TextureNode. Wrapping it in texture() loses its
      // render dependency and supplies a Node where the renderer expects a Texture.
      const backdropNode: any = backdropTex
        ? (backdropTex.isNode ? backdropTex : (textureNode(backdropTex) as any).setUpdateMatrix(false))
        : viewportSharedTexture()
      const refraction: any = buildTransmissionBackdropNode(
        backdropNode, transmissionUniforms, compiledSamples, { spectral: compiledSpectral },
      )
      // Evaluate after setupDiffuseColor/setupVariants: normalWorld, roughness and
      // dispersion are not initialized when colorNode is evaluated.
      next.backdropNode = refraction.rgb
      next.backdropAlphaNode = uTransmission
      next.transparent = true
      if (cleanBackdrop) {
        const back = next.clone()
        back.name = 'ArtinosGlassBacksideMaterial'
        back.side = THREE.BackSide
        back.thicknessNode = transmissionUniforms.backsideThickness
        back.backdropNode = buildTransmissionBackdropNode(
          cleanBackdrop, { ...transmissionUniforms, thickness: transmissionUniforms.backsideThickness },
          compiledSamples, { spectral: compiledSpectral },
        ).rgb
        next.transmissionBacksideMaterial = back
      }
    }

    const bundle = { uTime, transmission: uTransmission, transmissionParams: transmissionUniforms }
    applyProps(next, bundle, initial)
    return { material: next, uniforms: bundle }
  }, [renderer, backdropTex, cleanBackdrop, props.screenSpaceBackdrop, compiledSamples, compiledSpectral])

  useImperativeHandle(fref, () => material, [material])

  useEffect(() => { applyProps(material, uniforms, props) })

  // Mirror the backdrop texture's cover-fit transform so the refracted UVs land on the same
  // pixels the backdrop plane shows.
  useFrame(() => {
    const map = useImageBackdrop ? latest.current.backdropMap : null
    if (!map) return
    uniforms.transmissionParams.backdropScale.value.set(map.repeat.x, map.repeat.y)
    uniforms.transmissionParams.backdropOffset.value.set(map.offset.x, map.offset.y)
  })

  useEffect(() => () => { material.transmissionBacksideMaterial?.dispose(); material.dispose() }, [material])

  useFrame((_state: any, delta: number) => {
    uniforms.uTime.value += delta
    const live = latest.current
    if (live.samples !== compiledSamples) setCompiledSamples(live.samples)
    if (live.spectralDispersion !== compiledSpectral) setCompiledSpectral(live.spectralDispersion)
  })

  return <primitive object={material} attach="material" />
})

export default GlassMaterial
