/**
 * TSL volume refraction for the WebGPU transmission material.
 *
 * Ported from Anderson Mancini's WebGPU Mesh Transmission Material, merging both of his
 * variants: the prop-driven `webgpu-glass-drei` node graph (which keeps the grazing-angle
 * thickness boost) plus the `webgpu-mesh-transmission-material` spectral dispersion mode.
 *
 * The refraction path is: refract the view direction by IOR, walk it through the volume scaled
 * by thickness x model scale, exit in world space, project to NDC, and sample the backdrop
 * buffer the glass passes capture (see ./glass-capture.ts).
 */
import {
  Fn as tslFn,
  Loop,
  float,
  vec2,
  vec3,
  vec4,
  refract,
  normalize,
  length,
  clamp,
  log,
  log2,
  exp,
  mix,
  pow,
  max,
  abs,
  select,
  div,
  int,
  cross,
  dFdx,
  dFdy,
  screenCoordinate,
  cameraPosition,
  cameraViewMatrix,
  cameraProjectionMatrix,
  modelWorldMatrix,
  normalWorld,
  positionWorld,
  diffuseColor,
  specularColor,
  metalness,
  specularF90,
  roughness,
  triNoise3D,
  DFGLUT,
  interleavedGradientNoise,
  vogelDiskSample,
} from 'three/tsl'

// r185 runtime supports explicit function layouts, ahead of the published callable typings.
const Fn: any = tslFn

const MAX_TRANSMISSION_SAMPLES = 16
const SPECTRAL_LOBE_WIDTH = 1.0
const PI2 = 6.28318530718

export interface TransmissionUniforms {
  ior: any
  dispersion: any
  thickness: any
  backsideThickness: any
  anisotropicBlur: any
  distortion: any
  distortionScale: any
  temporalDistortion: any
  attenuationDistance: any
  attenuationColor: any
  time: any
  /** Cover-fit transform applied to the refracted screen UV before sampling the backdrop. */
  backdropScale: any
  backdropOffset: any
}

const spectralWeight = Fn(([t]: any) => {
  const x = t.mul(3.0)
  const lobeWidth = float(SPECTRAL_LOBE_WIDTH)
  const r = max(float(0), float(1).sub(abs(x.sub(0.5)).div(lobeWidth)))
  const g = max(float(0), float(1).sub(abs(x.sub(1.5)).div(lobeWidth)))
  const b = max(float(0), float(1).sub(abs(x.sub(2.5)).div(lobeWidth)))
  return vec3(r, g, b)
}).setLayout({ name: 'spectralWeight', type: 'vec3', inputs: [{ name: 't', type: 'float' }] })

const getVolumeTransmissionRay = Fn(([n, v, thicknessVal, iorVal, modelMatrix]: any) => {
  const refractionVector = vec3(refract(v.negate(), normalize(n), div(1.0, iorVal)) as any)
  const modelScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz))
  return normalize(refractionVector).mul(thicknessVal.mul(modelScale))
}).setLayout({
  name: 'getVolumeTransmissionRay',
  type: 'vec3',
  inputs: [
    { name: 'n', type: 'vec3' },
    { name: 'v', type: 'vec3' },
    { name: 'thicknessVal', type: 'float' },
    { name: 'iorVal', type: 'float' },
    { name: 'modelMatrix', type: 'mat4' },
  ],
})

const applyIorToRoughness = Fn(([roughnessVal, iorVal]: any) =>
  roughnessVal.mul(clamp(iorVal.mul(2.0).sub(2.0), 0.0, 1.0)),
).setLayout({
  name: 'applyIorToRoughness',
  type: 'float',
  inputs: [
    { name: 'roughnessVal', type: 'float' },
    { name: 'iorVal', type: 'float' },
  ],
})

/** Beer-Lambert absorption through the volume. */
const volumeAttenuation = Fn(([transmissionDistance, attColor, attDistance]: any) => {
  const attenuationCoefficient = log(max(attColor, vec3(1e-6))).negate().div(max(attDistance, 1e-6))
  const transmittance = exp(attenuationCoefficient.negate().mul(transmissionDistance))
  return select(attDistance.notEqual(0.0), transmittance, vec3(1.0))
}).setLayout({
  name: 'volumeAttenuation',
  type: 'vec3',
  inputs: [
    { name: 'transmissionDistance', type: 'float' },
    { name: 'attColor', type: 'vec3' },
    { name: 'attDistance', type: 'float' },
  ],
})

const refractionCoordsFor = Fn(
  ([n, v, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix]: any) => {
    const transmissionRay = getVolumeTransmissionRay(n, v, thicknessVal, iorVal, modelMatrix)
    const refractedRayExit = position.add(transmissionRay)
    const ndcPos = projMatrix.mul(viewMatrix.mul(vec4(refractedRayExit, 1.0)))
    const coords = vec2(ndcPos.xy.div(ndcPos.w)).toVar()
    coords.addAssign(1.0)
    coords.divAssign(2.0)
    coords.assign(vec2(coords.x, coords.y.oneMinus()))
    return coords
  },
)

/**
 * Width, in backdrop texels, of the area this pixel's refracted tap covers.
 *
 * `.level()` needs an explicit value here rather than the GPU's implicit derivative: that
 * implicit path only sees a well-defined screen-space gradient outside dynamic control flow,
 * and inside the sample Loop below it produced garbage per-pixel LOD — visible as speckle,
 * worse than the flat mip-0 read it was meant to replace. Measuring it once here, before the
 * loop, keeps the derivative in real uniform flow.
 */
function backdropFootprintLod(coords: any, textureSize: any) {
  const coordsPx = coords.mul(textureSize)
  const footprint = max(length(dFdx(coordsPx)), length(dFdy(coordsPx)))
  return log2(max(footprint, 1.0))
}

function createGetTransmissionSample(backdropTextureNode: any, uniforms: TransmissionUniforms) {
  // A single hardware trilinear tap rather than a bicubic reconstruction: select() evaluates
  // both branches, so bicubic cost was paid on every sample even at roughness 0.
  return Fn(([fragCoord, roughnessVal, iorVal, minLod]: any) => {
    const roughnessLod = applyIorToRoughness(roughnessVal, iorVal)
    const lod = max(log2(float(backdropTextureNode.size().x)).mul(roughnessLod), minLod)
    const uv = fragCoord.mul(uniforms.backdropScale).add(uniforms.backdropOffset)
    return backdropTextureNode.sample(uv).level(lod)
  })
}

function createRefractSample(getTransmissionSample: any) {
  return Fn(
    ([n, v, roughnessVal, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix, minLod]: any) => {
      const coords = refractionCoordsFor(n, v, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix)
      return getTransmissionSample(coords, roughnessVal, iorVal, minLod)
    },
  )
}

export interface VolumeRefractionOptions {
  /**
   * Walk a stratified spectrum with lobe weights instead of the fixed R/G/B three-tap. Costs
   * nothing extra per sample but needs more samples to stop banding. Recompiles the graph.
   */
  spectral?: boolean
}

export function createVolumeRefraction(
  backdropTextureNode: any,
  uniforms: TransmissionUniforms,
  requestedSamples = 10,
  { spectral = false }: VolumeRefractionOptions = {},
) {
  // Baked into the loop bounds so unused iterations are never executed. A uniform sample count
  // would always run MAX_TRANSMISSION_SAMPLES and mask the surplus with a multiply.
  // Fewer than three spectral strata can leave an RGB lobe with zero weight.
  const samples = Math.min(MAX_TRANSMISSION_SAMPLES, Math.max(spectral ? 3 : 1, Math.round(requestedSamples)))

  const getTransmissionSample = createGetTransmissionSample(backdropTextureNode, uniforms)
  const refractSample = createRefractSample(getTransmissionSample)

  return Fn(() => {
    const n = normalWorld
    const position = positionWorld
    const v = cameraPosition.sub(positionWorld).normalize()
    const roughnessVal = roughness
    const diffuse = diffuseColor.rgb
    const specColor = mix(specularColor, diffuseColor.rgb, metalness)
    const specF90 = specularF90
    const modelMatrix = modelWorldMatrix
    const viewMatrix = cameraViewMatrix
    const projMatrix = cameraProjectionMatrix
    const iorVal = uniforms.ior
    const thicknessVal = uniforms.thickness
    const attColor = uniforms.attenuationColor
    const attDistance = uniforms.attenuationDistance
    const sampleCount = float(samples)

    const transmissionAccum = vec3(0.0).toVar()
    const weightAccum = vec3(0.0).toVar()
    const randomCoords = interleavedGradientNoise(screenCoordinate.xy)
    const phi = interleavedGradientNoise(screenCoordinate.xy.add(vec2(17.0, 31.0))).mul(PI2)

    const thicknessSmear = thicknessVal.mul(max(pow(roughnessVal, 0.33), uniforms.anisotropicBlur))

    // Grazing angles travel further through the volume than the flat thickness suggests, so the
    // rim thickens and the distortion is weighted towards it.
    const edgeFactor = pow(float(1).sub(n.dot(v).clamp()), float(2.0))
    const edgeThicknessBoost = thicknessVal.mul(edgeFactor.mul(0.55))

    const distortionAmt = uniforms.distortion
    const temporalOffset = vec3(uniforms.time, uniforms.time.negate(), uniforms.time.negate()).mul(
      uniforms.temporalDistortion,
    )
    const noisePos = position.mul(uniforms.distortionScale).add(temporalOffset)
    const distortionNormal = distortionAmt
      .mul(float(0.15).add(edgeFactor.mul(0.85)))
      .mul(
        vec3(
          triNoise3D(noisePos, float(0.2), uniforms.time),
          triNoise3D(noisePos.zxy, float(0.2), uniforms.time),
          triNoise3D(noisePos.yxz, float(0.2), uniforms.time),
        ),
      )

    // three.js PhysicalLightingModel dispersion — per-channel IOR spread.
    const halfSpread = iorVal.sub(1.0).mul(uniforms.dispersion.mul(0.025))
    const iorR = iorVal.sub(halfSpread)
    const iorG = iorVal
    const iorB = iorVal.add(halfSpread)

    // Measured once from the un-jittered geometric normal/thickness, in real uniform control
    // flow — see backdropFootprintLod for why this cannot be measured per sample in the loop.
    const refractionLod = backdropFootprintLod(
      refractionCoordsFor(n, v, iorVal, thicknessVal, position, modelMatrix, viewMatrix, projMatrix),
      vec2(backdropTextureNode.size()),
    )

    // Branchless orthonormal basis for roughness jitter — no mesh tangents needed.
    const basisUp = abs(n.z).lessThan(0.999).select(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0))
    const tangent = normalize(cross(basisUp, n))
    const bitangent = cross(n, tangent)
    const roughnessScale = roughnessVal.mul(roughnessVal).mul(2.0)

    Loop({ start: 0, end: samples, type: 'float', condition: '<' }, ({ i }: any) => {
      const disk = vogelDiskSample(int(i), int(samples), phi)
      const jitter = tangent.mul(disk.x).add(bitangent.mul(disk.y))
      const sampleNorm = normalize(n.add(roughnessScale.mul(jitter)).add(distortionNormal))

      // Phase of the thickness-smear sweep. A white-noise hash here offsets each pixel's
      // backdrop tap by a couple of pixels at random, which speckles high-contrast backdrops,
      // so it uses an ordered dither instead.
      const sampleOffset = i.add(randomCoords).div(sampleCount)
      const sampleThickness = thicknessVal.add(thicknessSmear.mul(sampleOffset)).add(edgeThicknessBoost)

      if (spectral) {
        // Every pixel walks the same stratified spectrum. Randomising the phase per pixel
        // trades banding for chroma noise, which reads as coloured speckle on a busy backdrop.
        const t = i.add(0.5).div(sampleCount)
        const iorT = mix(iorR, iorB, t)
        const w = spectralWeight(t)
        const sample = refractSample(
          sampleNorm, v, roughnessVal, iorT, sampleThickness,
          position, modelMatrix, viewMatrix, projMatrix, refractionLod,
        )
        transmissionAccum.addAssign(sample.rgb.mul(w))
        weightAccum.addAssign(w)
      } else {
        const sampleR = refractSample(sampleNorm, v, roughnessVal, iorR, sampleThickness, position, modelMatrix, viewMatrix, projMatrix, refractionLod).r
        const sampleG = refractSample(sampleNorm, v, roughnessVal, iorG, sampleThickness, position, modelMatrix, viewMatrix, projMatrix, refractionLod).g
        const sampleB = refractSample(sampleNorm, v, roughnessVal, iorB, sampleThickness, position, modelMatrix, viewMatrix, projMatrix, refractionLod).b
        transmissionAccum.addAssign(vec3(sampleR, sampleG, sampleB))
      }
    })

    if (spectral) transmissionAccum.divAssign(max(weightAccum, vec3(1e-4)))
    else transmissionAccum.divAssign(sampleCount)

    const transmissionRay = getVolumeTransmissionRay(n, v, thicknessVal, iorVal, modelMatrix)
    const attenuatedColor = diffuse
      .mul(volumeAttenuation(length(transmissionRay), attColor, attDistance))
      .mul(transmissionAccum)

    const dfg: any = DFGLUT({ roughness: roughnessVal, dotNV: n.dot(v).clamp() })
    const fresnel = specColor.mul(dfg.x).add(specF90.mul(dfg.y))
    return vec4(fresnel.oneMinus().mul(attenuatedColor), float(1.0))
  })
}

export function buildTransmissionBackdropNode(
  backdropTextureNode: any,
  uniforms: TransmissionUniforms,
  requestedSamples = 10,
  options: VolumeRefractionOptions = {},
) {
  if (!backdropTextureNode) return null
  return createVolumeRefraction(backdropTextureNode, uniforms, requestedSamples, options)()
}
