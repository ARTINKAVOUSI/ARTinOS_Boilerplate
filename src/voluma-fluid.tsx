import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useArtinosRuntime, useResolvedParameter, useResolvedParameterRef, useSignal, type ParameterDefinition } from '@artinos/runtime'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js'

type Renderer = THREE.WebGPURenderer & { compute(node: unknown): void }
type ComputeNode = { dispose?(): void; setName?(name: string): ComputeNode }
type UniformNode<T> = { value: T }

export interface FluidRuntimeDefinitions {
  playing: ParameterDefinition<boolean>
  emitterEnabled: ParameterDefinition<boolean>
  carrier: ParameterDefinition
  quality: ParameterDefinition
  species: ParameterDefinition
  emitterPattern: ParameterDefinition
  interaction: ParameterDefinition
  debugView: ParameterDefinition
  thickness: ParameterDefinition<number>
  swirl: ParameterDefinition<number>
  glow: ParameterDefinition<number>
  audio: ParameterDefinition<number>
  vorticity: ParameterDefinition<number>
  viscosity: ParameterDefinition<number>
  buoyancy: ParameterDefinition<number>
  diffusion: ParameterDefinition<number>
  pressure: ParameterDefinition<number>
  emitterMass: ParameterDefinition<number>
  circulation: ParameterDefinition<number>
  radius: ParameterDefinition<number>
  exposure: ParameterDefinition<number>
  lightAzimuth: ParameterDefinition<number>
  lightElevation: ParameterDefinition<number>
  lightIntensity: ParameterDefinition<number>
}

type QualitySpec = { velocity: number; species: number; light: number; pressure: number; march: number }

const QUALITY: Record<string, QualitySpec> = {
  draft: { velocity: 64, species: 96, light: 32, pressure: 10, march: 48 },
  live: { velocity: 96, species: 128, light: 48, pressure: 18, march: 88 },
  studio: { velocity: 128, species: 160, light: 64, pressure: 28, march: 136 },
  hero: { velocity: 160, species: 192, light: 80, pressure: 40, march: 192 },
}

const SPECIES_VECTOR: Record<string, THREE.Vector4> = {
  'cyan-ink': new THREE.Vector4(1, 0, 0, 0),
  'magenta-dye': new THREE.Vector4(0, 1, 0, 0),
  milk: new THREE.Vector4(0, 0, 1, 0),
  'oil-gold': new THREE.Vector4(0, 0, 0, 1),
  'neon-orchid': new THREE.Vector4(.08, .62, 0, .3),
  watercolor: new THREE.Vector4(.72, .28, 0, 0),
  'dense-paint': new THREE.Vector4(.08, .1, .78, .04),
  acrylic: new THREE.Vector4(.36, .28, .36, 0),
  smoke: new THREE.Vector4(.02, .03, .72, 0),
  'pearl-lacquer': new THREE.Vector4(.04, .02, .28, .78),
}

const CARRIER: Record<string, { viscosity: number; damping: number; buoyancy: number; extinction: THREE.Vector3; scattering: THREE.Vector3; surfaceTension: number }> = {
  'clear-water': { viscosity: 1, damping: .9992, buoyancy: 1, extinction: new THREE.Vector3(.008, .004, .003), scattering: new THREE.Vector3(.006, .008, .012), surfaceTension: .75 },
  'viscous-water': { viscosity: 2.35, damping: .9965, buoyancy: .7, extinction: new THREE.Vector3(.012, .008, .006), scattering: new THREE.Vector3(.012, .016, .02), surfaceTension: .8 },
  'oil-bath': { viscosity: 3.4, damping: .993, buoyancy: .48, extinction: new THREE.Vector3(.05, .027, .008), scattering: new THREE.Vector3(.016, .012, .006), surfaceTension: .18 },
  gel: { viscosity: 5.8, damping: .988, buoyancy: .25, extinction: new THREE.Vector3(.024, .02, .016), scattering: new THREE.Vector3(.035, .04, .045), surfaceTension: .62 },
  'thin-mist': { viscosity: .32, damping: .9985, buoyancy: 1.7, extinction: new THREE.Vector3(.052, .06, .07), scattering: new THREE.Vector3(.09, .1, .12), surfaceTension: .05 },
  'dense-fog': { viscosity: .45, damping: .994, buoyancy: 1.45, extinction: new THREE.Vector3(.09, .1, .115), scattering: new THREE.Vector3(.2, .22, .25), surfaceTension: .03 },
  'smoke-air': { viscosity: .24, damping: .997, buoyancy: 1.9, extinction: new THREE.Vector3(.045, .05, .055), scattering: new THREE.Vector3(.08, .085, .09), surfaceTension: .02 },
  'resin-slow': { viscosity: 8.2, damping: .982, buoyancy: .16, extinction: new THREE.Vector3(.035, .022, .014), scattering: new THREE.Vector3(.018, .02, .024), surfaceTension: .88 },
  custom: { viscosity: 1.4, damping: .996, buoyancy: .8, extinction: new THREE.Vector3(.012, .012, .014), scattering: new THREE.Vector3(.016, .018, .022), surfaceTension: .5 },
}

const DEBUG_MODE: Record<string, number> = {
  beauty: 0, species: 1, density: 2, velocity: 3, vorticity: 4, pressure: 5,
  temperature: 6, occupancy: 7, transmittance: 8, normals: 9, interface: 10,
  audio: 11, emitters: 12,
}

function makeTexture(size: number, name: string) {
  const texture = new THREE.Storage3DTexture(size, size, size)
  texture.name = name
  texture.type = THREE.HalfFloatType
  texture.format = THREE.RGBAFormat
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.NoColorSpace
  return texture
}

function compute3D(size: number, body: () => unknown, name: string): ComputeNode {
  const groups = Math.ceil(size / 4)
  const node = (TSL.Fn(body)() as any).compute([groups, groups, groups], [4, 4, 4]) as ComputeNode
  node.setName?.(name)
  return node
}

const tex = (texture: THREE.Texture, uv: any) => (TSL.texture3D(texture as any) as any).sample(uv)
const store = (texture: THREE.Texture, coord: any, value: any) => (TSL.textureStore(texture as any, coord, value) as any).toWriteOnly()
const nestedMin = (a: any, b: any, c: any, d: any, e: any, f: any) => TSL.min(TSL.min(TSL.min(a, b), TSL.min(c, d)), TSL.min(e, f))
const nestedMax = (a: any, b: any, c: any, d: any, e: any, f: any) => TSL.max(TSL.max(TSL.max(a, b), TSL.max(c, d)), TSL.max(e, f))

export class VolumetricFluidPipeline {
  readonly velocitySize: number
  readonly speciesSize: number
  readonly lightSize: number
  readonly maxPressureIterations: number

  readonly velocityState: THREE.Storage3DTexture
  readonly velocityWork: THREE.Storage3DTexture
  readonly velocityForward: THREE.Storage3DTexture
  readonly velocityBack: THREE.Storage3DTexture
  readonly concentrationState: THREE.Storage3DTexture
  readonly concentrationEmitted: THREE.Storage3DTexture
  readonly concentrationForward: THREE.Storage3DTexture
  readonly concentrationBack: THREE.Storage3DTexture
  readonly temperatureState: THREE.Storage3DTexture
  readonly temperatureWork: THREE.Storage3DTexture
  readonly pressureA: THREE.Storage3DTexture
  readonly pressureB: THREE.Storage3DTexture
  readonly divergence: THREE.Storage3DTexture
  readonly curl: THREE.Storage3DTexture
  readonly obstacle: THREE.Storage3DTexture
  readonly occupancy: THREE.Storage3DTexture
  readonly transmittance: THREE.Storage3DTexture
  readonly material: THREE.NodeMaterial

  private readonly dt = TSL.uniform(.012) as unknown as UniformNode<number>
  private readonly emit = TSL.uniform(0) as unknown as UniformNode<number>
  private readonly emitter = TSL.uniform(new THREE.Vector3(.5, .78, .5)) as unknown as UniformNode<THREE.Vector3>
  private readonly species = TSL.uniform(new THREE.Vector4(1, 0, 0, 0)) as unknown as UniformNode<THREE.Vector4>
  private readonly mass = TSL.uniform(1.1) as unknown as UniformNode<number>
  private readonly ringRadius = TSL.uniform(.14) as unknown as UniformNode<number>
  private readonly circulation = TSL.uniform(2.2) as unknown as UniformNode<number>
  private readonly emitterShape = TSL.uniform(0) as unknown as UniformNode<number>
  private readonly interactionMass = TSL.uniform(1) as unknown as UniformNode<number>
  private readonly interactionImpulse = TSL.uniform(new THREE.Vector3()) as unknown as UniformNode<THREE.Vector3>
  private readonly interactionPull = TSL.uniform(0) as unknown as UniformNode<number>
  private readonly vorticity = TSL.uniform(1.85) as unknown as UniformNode<number>
  private readonly viscosity = TSL.uniform(.16) as unknown as UniformNode<number>
  private readonly buoyancy = TSL.uniform(-.45) as unknown as UniformNode<number>
  private readonly diffusion = TSL.uniform(.012) as unknown as UniformNode<number>
  private readonly opticalThickness = TSL.uniform(1.15) as unknown as UniformNode<number>
  private readonly carrierViscosity = TSL.uniform(1) as unknown as UniformNode<number>
  private readonly carrierDamping = TSL.uniform(.999) as unknown as UniformNode<number>
  private readonly carrierBuoyancy = TSL.uniform(1) as unknown as UniformNode<number>
  private readonly carrierExtinction = TSL.uniform(new THREE.Vector3(.008, .004, .003)) as unknown as UniformNode<THREE.Vector3>
  private readonly carrierScattering = TSL.uniform(new THREE.Vector3(.006, .008, .012)) as unknown as UniformNode<THREE.Vector3>
  private readonly carrierFill = TSL.uniform(0) as unknown as UniformNode<number>
  private readonly surfaceTension = TSL.uniform(.75) as unknown as UniformNode<number>
  private readonly edgeGlow = TSL.uniform(.36) as unknown as UniformNode<number>
  private readonly debugMode = TSL.uniform(0) as unknown as UniformNode<number>
  private readonly lightDirection = TSL.uniform(new THREE.Vector3(.32, .58, .75).normalize()) as unknown as UniformNode<THREE.Vector3>
  private readonly lightEnergy = TSL.uniform(1.35) as unknown as UniformNode<number>
  private readonly exposure = TSL.uniform(1.1) as unknown as UniformNode<number>
  private readonly audioDebug = TSL.uniform(new THREE.Vector3()) as unknown as UniformNode<THREE.Vector3>

  private readonly clearNodes: ComputeNode[]
  private readonly emitterVelocityNode: ComputeNode
  private readonly emitterSpeciesNode: ComputeNode
  private readonly curlNode: ComputeNode
  private readonly vorticityNode: ComputeNode
  private readonly divergenceNode: ComputeNode
  private readonly pressureAB: ComputeNode
  private readonly pressureBA: ComputeNode
  private readonly projectNode: ComputeNode
  private readonly velocityForwardNode: ComputeNode
  private readonly velocityBackNode: ComputeNode
  private readonly velocityCorrectNode: ComputeNode
  private readonly speciesForwardNode: ComputeNode
  private readonly speciesBackNode: ComputeNode
  private readonly speciesCorrectNode: ComputeNode
  private readonly temperatureNode: ComputeNode
  private readonly occupancyNode: ComputeNode
  private readonly lightNode: ComputeNode
  private readonly computeNodes: ComputeNode[]

  private pressureIterations = 10
  private initialized = false
  private elapsed = 0
  // The volume stays responsive at the display refresh rate, while the heavy
  // 3D compute pipeline is capped to a safe simulation cadence. On integrated
  // GPUs, dispatching every pass at every display frame was enough to hang the
  // WebGPU device before the fluid had time to develop.
  private simulationAccumulator = 0
  private nextEmission = 7.5
  private queued = false
  private disposed = false
  private emitterPattern = 'single'
  private emissionIndex = 0

  constructor(spec: QualitySpec) {
    this.velocitySize = spec.velocity
    this.speciesSize = spec.species
    this.lightSize = spec.light
    this.maxPressureIterations = spec.pressure

    this.velocityState = makeTexture(spec.velocity, 'fluid.velocity.state')
    this.velocityWork = makeTexture(spec.velocity, 'fluid.velocity.work')
    this.velocityForward = makeTexture(spec.velocity, 'fluid.velocity.forward')
    this.velocityBack = makeTexture(spec.velocity, 'fluid.velocity.back')
    this.concentrationState = makeTexture(spec.species, 'fluid.species.state')
    this.concentrationEmitted = makeTexture(spec.species, 'fluid.species.emitted')
    this.concentrationForward = makeTexture(spec.species, 'fluid.species.forward')
    this.concentrationBack = makeTexture(spec.species, 'fluid.species.back')
    this.temperatureState = makeTexture(spec.species, 'fluid.temperature.state')
    this.temperatureWork = makeTexture(spec.species, 'fluid.temperature.work')
    this.pressureA = makeTexture(spec.velocity, 'fluid.pressure.a')
    this.pressureB = makeTexture(spec.velocity, 'fluid.pressure.b')
    this.divergence = makeTexture(spec.velocity, 'fluid.divergence')
    this.curl = makeTexture(spec.velocity, 'fluid.curl')
    this.obstacle = makeTexture(spec.velocity, 'fluid.obstacle')
    this.occupancy = makeTexture(spec.species, 'fluid.occupancy')
    this.transmittance = makeTexture(spec.light, 'fluid.light.transmittance')

    const id = () => TSL.uvec3(TSL.globalId)
    const uvFor = (size: number) => (TSL.vec3(TSL.globalId) as any).add(.5).div(size)
    const offsetFor = (size: number, x: number, y: number, z: number) => TSL.vec3(x / size, y / size, z / size)
    const velUv = () => uvFor(spec.velocity)
    const dyeUv = () => uvFor(spec.species)
    const lightUv = () => uvFor(spec.light)
    const vo = (x: number, y: number, z: number) => offsetFor(spec.velocity, x, y, z)
    const co = (x: number, y: number, z: number) => offsetFor(spec.species, x, y, z)

    const clearVelocity = compute3D(spec.velocity, () => {
      const coord = id()
      store(this.velocityState, coord, TSL.vec4(0))
      store(this.velocityWork, coord, TSL.vec4(0))
      store(this.velocityForward, coord, TSL.vec4(0))
      store(this.velocityBack, coord, TSL.vec4(0))
    }, 'Fluid / Clear velocity family')

    const clearProjection = compute3D(spec.velocity, () => {
      const coord = id()
      store(this.pressureA, coord, TSL.vec4(0))
      store(this.pressureB, coord, TSL.vec4(0))
      store(this.divergence, coord, TSL.vec4(0))
      store(this.curl, coord, TSL.vec4(0))
    }, 'Fluid / Clear projection family')

    const clearObstacle = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const lower = TSL.vec3(p.lessThan(1.5 / spec.velocity))
      const upper = TSL.vec3(p.greaterThan(1 - 1.5 / spec.velocity))
      const normal = lower.sub(upper)
      const wall = normal.abs().x.add(normal.abs().y, normal.abs().z).min(1)
      store(this.obstacle, coord, TSL.vec4(normal, wall))
    }, 'Fluid / Tank wall obstacle field')

    const clearSpecies = compute3D(spec.species, () => {
      const coord = id()
      // Start genuinely clear. A hard-coded cyan seed polluted every material
      // and accumulated into the large soft blobs seen in the preview.
      const initial = TSL.vec4(0)
      store(this.concentrationState, coord, initial)
      store(this.concentrationEmitted, coord, initial)
      store(this.concentrationForward, coord, initial)
      store(this.concentrationBack, coord, initial)
    }, 'Fluid / Clear high-resolution species')

    const clearSpeciesAux = compute3D(spec.species, () => {
      const coord = id()
      store(this.temperatureState, coord, TSL.vec4(0))
      store(this.temperatureWork, coord, TSL.vec4(0))
      store(this.occupancy, coord, TSL.vec4(0))
    }, 'Fluid / Clear temperature + occupancy')

    const clearLight = compute3D(spec.light, () => {
      store(this.transmittance, id(), TSL.vec4(1))
    }, 'Fluid / Clear transmittance')

    this.clearNodes = [clearVelocity, clearProjection, clearObstacle, clearSpecies, clearSpeciesAux, clearLight]

    this.emitterVelocityNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const oldV = tex(this.velocityState, p).xyz
      const c = tex(this.concentrationState, p)
      const temperature = tex(this.temperatureState, p).r
      const q = (TSL.vec3(p) as any).sub(this.emitter as any)
      const radial = TSL.vec2(q.x, q.z).length().max(.0001)
      const ringDelta = radial.sub(this.ringRadius as any)
      const ringDistance2 = ringDelta.mul(ringDelta).add(q.y.mul(q.y))
      const ring = ringDistance2.mul(-340).exp().mul(this.emit as any)
      const coreDistance2 = q.x.mul(q.x).add(q.z.mul(q.z), q.y.add(.035).mul(q.y.add(.035)).mul(3.2))
      const core = coreDistance2.mul(-360).exp().mul(this.emit as any)
      const point = q.dot(q).mul(-260).exp().mul(this.emit as any)
      // Wider authored jets remain legible at the Draft 64³ velocity grid and
      // avoid the near-invisible one-voxel tendrils seen in the live preview.
      const jet = q.x.mul(q.x).add(q.z.mul(q.z)).mul(-180).add(q.y.mul(q.y).mul(-28)).exp().mul(this.emit as any)
      const sheet = q.y.mul(q.y).mul(-900).add(q.z.mul(q.z).mul(-180), q.x.mul(q.x).mul(-42)).exp().mul(this.emit as any)
      const shapeMass = TSL.select((this.emitterShape as any).equal(1), jet, TSL.select((this.emitterShape as any).equal(2), sheet, TSL.select((this.emitterShape as any).equal(3), point, ring)))
      const radialDir = TSL.vec3(q.x.div(radial), 0, q.z.div(radial))
      const tangent = TSL.vec3(radialDir.x.mul(q.y) as any, ringDelta.negate() as any, radialDir.z.mul(q.y) as any).normalize()
      const pull = (TSL.vec3(q) as any).add(.00001).normalize().mul(this.interactionPull as any)
      const ringMotion = tangent.mul(this.circulation as any).add(TSL.vec3(0, -.12, 0)).mul(ring).add(TSL.vec3(0, -.55, 0).mul(core))
      const jetMotion = TSL.vec3(0, -3.1, 0).mul(jet)
      const sheetMotion = TSL.vec3(.85, -.3, 0).mul(sheet)
      const pointMotion = TSL.vec3(0, -.72, 0).mul(point)
      const authoredShape = TSL.select((this.emitterShape as any).equal(1), jetMotion, TSL.select((this.emitterShape as any).equal(2), sheetMotion, TSL.select((this.emitterShape as any).equal(3), pointMotion, ringMotion)))
      const authored = authoredShape.add(TSL.vec3(this.interactionImpulse as any).mul(shapeMass), pull.mul(shapeMass))

      const densityDelta = c.dot(TSL.vec4(.42, -.18, .04, .68))
      const thermal = temperature.mul(.36)
      const buoyancyForce = TSL.vec3(0, (this.buoyancy as any).mul(this.carrierBuoyancy as any).mul(densityDelta.sub(thermal)).mul(this.dt as any), 0)

      const phase = c.a.sub(c.r.add(c.g, c.b))
      const phaseAt = (delta: any) => {
        const sample = tex(this.concentrationState, p.add(delta))
        return sample.a.sub(sample.r.add(sample.g, sample.b))
      }
      const px = phaseAt(vo(1, 0, 0)), mx = phaseAt(vo(-1, 0, 0))
      const py = phaseAt(vo(0, 1, 0)), my = phaseAt(vo(0, -1, 0))
      const pz = phaseAt(vo(0, 0, 1)), mz = phaseAt(vo(0, 0, -1))
      const gradient = TSL.vec3(px.sub(mx), py.sub(my), pz.sub(mz)).mul(.5 * spec.velocity)
      const gradLength = gradient.length().max(.0001)
      const curvature = px.add(mx, py, my, pz, mz).sub(phase.mul(6)).mul(-spec.velocity * spec.velocity).div(gradLength).clamp(-12, 12)
      const interfaceDelta = gradLength.mul(c.a.mul(c.r.add(c.g, c.b))).min(1)
      const csf = gradient.div(gradLength).mul(curvature).mul(interfaceDelta).mul(this.surfaceTension as any).mul(this.dt as any).mul(.018)

      const wall = tex(this.obstacle, p).w.oneMinus()
      const next = (TSL.vec3(oldV) as any).add(authored.mul(this.dt as any).mul(7), buoyancyForce, csf).mul(wall).clamp(-4, 4)
      store(this.velocityWork, coord, TSL.vec4(next, 0))
    }, 'Fluid / Emitters + buoyancy + CSF')

    this.emitterSpeciesNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv()
      const oldC = tex(this.concentrationState, p)
      const oldT = tex(this.temperatureState, p).r
      const q = (TSL.vec3(p) as any).sub(this.emitter as any)
      const radial = TSL.vec2(q.x, q.z).length().max(.0001)
      const ringDelta = radial.sub(this.ringRadius as any)
      const ring = ringDelta.mul(ringDelta).add(q.y.mul(q.y)).mul(-420).exp().mul(this.emit as any)
      const core = q.x.mul(q.x).add(q.z.mul(q.z), q.y.add(.035).mul(q.y.add(.035)).mul(2.4)).mul(-145).exp().mul(this.emit as any)
      const point = q.dot(q).mul(-280).exp().mul(this.emit as any)
      const jet = q.x.mul(q.x).add(q.z.mul(q.z)).mul(-180).add(q.y.mul(q.y).mul(-28)).exp().mul(this.emit as any)
      const sheet = q.y.mul(q.y).mul(-900).add(q.z.mul(q.z).mul(-180), q.x.mul(q.x).mul(-42)).exp().mul(this.emit as any)
      const tail = q.x.mul(q.x).add(q.z.mul(q.z)).mul(-260).add(q.y.sub(.1).mul(q.y.sub(.1)).mul(-24)).exp().mul(this.emit as any)
      // Vortex-ring emitters inject a compact material core into a toroidal
      // velocity field. Injecting concentration on the torus itself produced
      // a flat horizontal bar instead of a rolling mushroom cap.
      const coreWeight = TSL.float(1.25).sub((this.species as any).b.mul(.55))
      const tailWeight = TSL.float(.35).add((this.species as any).b.mul(1.2))
      const kernel = TSL.select((this.emitterShape as any).equal(1), jet, TSL.select((this.emitterShape as any).equal(2), sheet, TSL.select((this.emitterShape as any).equal(3), point, core.mul(coreWeight).add(tail.mul(tailWeight)))))
      const shapeGain = TSL.select(
        (this.emitterShape as any).equal(1), .75,
        TSL.select((this.emitterShape as any).equal(2), .1, TSL.select((this.emitterShape as any).equal(3), 1.4, 2.2)),
      )
      const materialGain = (this.species as any).dot(TSL.vec4(.8, .72, .22, .45)).max(.12)
      const source = kernel.mul(shapeGain).mul(materialGain).mul(this.mass as any).mul(this.interactionMass as any).mul(1.1)
      const nextC = TSL.vec4(oldC).add((this.species as any).mul(source)).clamp(0, 3.5)
      const nextT = oldT.add(source.mul(.12)).mul(.999)
      store(this.concentrationEmitted, coord, nextC)
      store(this.temperatureWork, coord, TSL.vec4(nextT, 0, 0, 0))
    }, 'Fluid / High-resolution species + temperature splat')

    this.curlNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const xp = tex(this.velocityWork, p.add(vo(1, 0, 0))).xyz, xm = tex(this.velocityWork, p.add(vo(-1, 0, 0))).xyz
      const yp = tex(this.velocityWork, p.add(vo(0, 1, 0))).xyz, ym = tex(this.velocityWork, p.add(vo(0, -1, 0))).xyz
      const zp = tex(this.velocityWork, p.add(vo(0, 0, 1))).xyz, zm = tex(this.velocityWork, p.add(vo(0, 0, -1))).xyz
      const scale = .5 * spec.velocity
      const omega = TSL.vec3(zp.y.sub(zm.y).sub(yp.z.sub(ym.z)), xp.z.sub(xm.z).sub(zp.x.sub(zm.x)), yp.x.sub(ym.x).sub(xp.y.sub(xm.y))).mul(scale)
      store(this.curl, coord, TSL.vec4(omega, omega.length()))
    }, 'Fluid / Curl')

    this.vorticityNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const v = tex(this.velocityWork, p).xyz
      const xp = tex(this.velocityWork, p.add(vo(1, 0, 0))).xyz, xm = tex(this.velocityWork, p.add(vo(-1, 0, 0))).xyz
      const yp = tex(this.velocityWork, p.add(vo(0, 1, 0))).xyz, ym = tex(this.velocityWork, p.add(vo(0, -1, 0))).xyz
      const zp = tex(this.velocityWork, p.add(vo(0, 0, 1))).xyz, zm = tex(this.velocityWork, p.add(vo(0, 0, -1))).xyz
      const omega = tex(this.curl, p).xyz
      const eta = TSL.vec3(
        tex(this.curl, p.add(vo(1, 0, 0))).w.sub(tex(this.curl, p.add(vo(-1, 0, 0))).w),
        tex(this.curl, p.add(vo(0, 1, 0))).w.sub(tex(this.curl, p.add(vo(0, -1, 0))).w),
        tex(this.curl, p.add(vo(0, 0, 1))).w.sub(tex(this.curl, p.add(vo(0, 0, -1))).w),
      ).add(.00001).normalize()
      const concentration = tex(this.concentrationEmitted, p)
      const localViscosity = (this.viscosity as any).mul(this.carrierViscosity as any).add(concentration.dot(TSL.vec4(.025, .008, .24, .52)))
      const confinement = TSL.cross(eta, omega).mul(this.vorticity as any).mul(this.dt as any).mul(.075)
      const laplace = xp.add(xm, yp, ym, zp, zm).sub(v.mul(6)).mul(localViscosity).mul(this.dt as any).mul(spec.velocity * .065)
      const wall = tex(this.obstacle, p).w.oneMinus()
      const next = TSL.vec3(v).add(confinement, laplace).mul(this.carrierDamping as any).mul(wall).clamp(-6, 6)
      store(this.velocityState, coord, TSL.vec4(next, 0))
    }, 'Fluid / Vorticity confinement + spatial viscosity')

    this.divergenceNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const xp = tex(this.velocityState, p.add(vo(1, 0, 0))).x, xm = tex(this.velocityState, p.add(vo(-1, 0, 0))).x
      const yp = tex(this.velocityState, p.add(vo(0, 1, 0))).y, ym = tex(this.velocityState, p.add(vo(0, -1, 0))).y
      const zp = tex(this.velocityState, p.add(vo(0, 0, 1))).z, zm = tex(this.velocityState, p.add(vo(0, 0, -1))).z
      const wall = tex(this.obstacle, p).w.oneMinus()
      const div = xp.sub(xm).add(yp.sub(ym), zp.sub(zm)).mul(.5 * spec.velocity).mul(wall)
      store(this.divergence, coord, TSL.vec4(div, 0, 0, 0))
    }, 'Fluid / Divergence with wall mask')

    const pressurePass = (input: THREE.Storage3DTexture, output: THREE.Storage3DTexture, name: string) => compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const sum = tex(input, p.add(vo(1, 0, 0))).r.add(tex(input, p.add(vo(-1, 0, 0))).r, tex(input, p.add(vo(0, 1, 0))).r, tex(input, p.add(vo(0, -1, 0))).r, tex(input, p.add(vo(0, 0, 1))).r, tex(input, p.add(vo(0, 0, -1))).r)
      const solved = sum.sub(tex(this.divergence, p).r.div(spec.velocity * spec.velocity)).div(6)
      const pressure = TSL.select(tex(this.obstacle, p).w.greaterThan(.5), TSL.float(0), solved)
      store(output, coord, TSL.vec4(pressure, 0, 0, 0))
    }, name)
    this.pressureAB = pressurePass(this.pressureA, this.pressureB, 'Fluid / Pressure A→B')
    this.pressureBA = pressurePass(this.pressureB, this.pressureA, 'Fluid / Pressure B→A')

    this.projectNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv(), v = tex(this.velocityState, p).xyz
      const gradient = TSL.vec3(
        tex(this.pressureA, p.add(vo(1, 0, 0))).r.sub(tex(this.pressureA, p.add(vo(-1, 0, 0))).r),
        tex(this.pressureA, p.add(vo(0, 1, 0))).r.sub(tex(this.pressureA, p.add(vo(0, -1, 0))).r),
        tex(this.pressureA, p.add(vo(0, 0, 1))).r.sub(tex(this.pressureA, p.add(vo(0, 0, -1))).r),
      ).mul(.5 * spec.velocity)
      const wall = tex(this.obstacle, p).w.oneMinus()
      store(this.velocityWork, coord, TSL.vec4(TSL.vec3(v).sub(gradient).mul(wall).clamp(-6, 6), 0))
    }, 'Fluid / Incompressible projection')

    this.velocityForwardNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv(), v = tex(this.velocityWork, p).xyz
      const previous = TSL.vec3(p).sub(v.mul(this.dt as any)).clamp(.002, .998)
      store(this.velocityForward, coord, TSL.vec4(tex(this.velocityWork, previous).xyz, 0))
    }, 'Fluid / Velocity MacCormack forward')

    this.velocityBackNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv(), v = tex(this.velocityWork, p).xyz
      const future = TSL.vec3(p).add(v.mul(this.dt as any)).clamp(.002, .998)
      store(this.velocityBack, coord, TSL.vec4(tex(this.velocityForward, future).xyz, 0))
    }, 'Fluid / Velocity MacCormack reverse')

    this.velocityCorrectNode = compute3D(spec.velocity, () => {
      const coord = id(), p = velUv()
      const original = tex(this.velocityWork, p).xyz
      const forward = tex(this.velocityForward, p).xyz
      const backward = tex(this.velocityBack, p).xyz
      const xp = tex(this.velocityWork, p.add(vo(1, 0, 0))).xyz, xm = tex(this.velocityWork, p.add(vo(-1, 0, 0))).xyz
      const yp = tex(this.velocityWork, p.add(vo(0, 1, 0))).xyz, ym = tex(this.velocityWork, p.add(vo(0, -1, 0))).xyz
      const zp = tex(this.velocityWork, p.add(vo(0, 0, 1))).xyz, zm = tex(this.velocityWork, p.add(vo(0, 0, -1))).xyz
      const corrected = TSL.vec3(forward).add(original.sub(backward).mul(.5))
      const clamped = corrected.clamp(nestedMin(xp, xm, yp, ym, zp, zm), nestedMax(xp, xm, yp, ym, zp, zm)).mul(.999)
      store(this.velocityState, coord, TSL.vec4(clamped, 0))
    }, 'Fluid / Velocity MacCormack correction + extrema clamp')

    this.speciesForwardNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv(), v = tex(this.velocityState, p).xyz
      const emitted = tex(this.concentrationEmitted, p)
      const total = emitted.dot(TSL.vec4(1)).max(.0001)
      const settling = emitted.dot(TSL.vec4(.08, .04, .015, -.025)).div(total)
      const previous = TSL.vec3(p).sub(v.mul(this.dt as any)).add(TSL.vec3(0, settling.mul(this.dt as any), 0)).clamp(.001, .999)
      store(this.concentrationForward, coord, tex(this.concentrationEmitted, previous))
    }, 'Fluid / Species MacCormack forward')

    this.speciesBackNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv(), v = tex(this.velocityState, p).xyz
      const forward = tex(this.concentrationForward, p)
      const total = forward.dot(TSL.vec4(1)).max(.0001)
      const settling = forward.dot(TSL.vec4(.08, .04, .015, -.025)).div(total)
      const future = TSL.vec3(p).add(v.mul(this.dt as any)).sub(TSL.vec3(0, settling.mul(this.dt as any), 0)).clamp(.001, .999)
      store(this.concentrationBack, coord, tex(this.concentrationForward, future))
    }, 'Fluid / Species MacCormack reverse')

    this.speciesCorrectNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv()
      const original = tex(this.concentrationEmitted, p)
      const forward = tex(this.concentrationForward, p)
      const backward = tex(this.concentrationBack, p)
      const xp = tex(this.concentrationEmitted, p.add(co(1, 0, 0))), xm = tex(this.concentrationEmitted, p.add(co(-1, 0, 0)))
      const yp = tex(this.concentrationEmitted, p.add(co(0, 1, 0))), ym = tex(this.concentrationEmitted, p.add(co(0, -1, 0)))
      const zp = tex(this.concentrationEmitted, p.add(co(0, 0, 1))), zm = tex(this.concentrationEmitted, p.add(co(0, 0, -1)))
      const corrected = TSL.vec4(forward).add(original.sub(backward).mul(.5)).clamp(nestedMin(xp, xm, yp, ym, zp, zm), nestedMax(xp, xm, yp, ym, zp, zm))
      const laplace = xp.add(xm, yp, ym, zp, zm).sub(forward.mul(6))
      const diffusion = TSL.vec4(.55, 1.35, .32, .045).mul(this.diffusion as any).mul(this.dt as any).mul(spec.species * .055)
      const diffuse = corrected.add(laplace.mul(diffusion))
      const aqueous = diffuse.r.add(diffuse.g, diffuse.b)
      const overlap = diffuse.a.mul(aqueous).mul(this.surfaceTension as any).mul(this.dt as any).mul(.9).min(.18)
      const separated = TSL.vec4(diffuse.rgb.mul(overlap.oneMinus()) as any, diffuse.a.add(overlap.mul(.12)) as any)
      const dissipated = separated.mul(TSL.vec4(.9992, .9988, .999, .9995)).clamp(0, 3.5)
      store(this.concentrationState, coord, dissipated)
    }, 'Fluid / Species correction + diffusion + immiscible separation')

    this.temperatureNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv(), v = tex(this.velocityState, p).xyz
      const previous = TSL.vec3(p).sub(v.mul(this.dt as any)).clamp(.001, .999)
      const value = tex(this.temperatureWork, previous).r.mul(.9985)
      store(this.temperatureState, coord, TSL.vec4(value, 0, 0, 0))
    }, 'Fluid / Temperature advection')

    this.occupancyNode = compute3D(spec.species, () => {
      const coord = id(), p = dyeUv(), c = tex(this.concentrationState, p)
      const density = c.r.add(c.g, c.b, c.a)
      const gx = tex(this.concentrationState, p.add(co(1, 0, 0))).dot(TSL.vec4(1)).sub(tex(this.concentrationState, p.add(co(-1, 0, 0))).dot(TSL.vec4(1)))
      const gy = tex(this.concentrationState, p.add(co(0, 1, 0))).dot(TSL.vec4(1)).sub(tex(this.concentrationState, p.add(co(0, -1, 0))).dot(TSL.vec4(1)))
      const gz = tex(this.concentrationState, p.add(co(0, 0, 1))).dot(TSL.vec4(1)).sub(tex(this.concentrationState, p.add(co(0, 0, -1))).dot(TSL.vec4(1)))
      const gradient = TSL.vec3(gx, gy, gz).mul(.5 * spec.species)
      store(this.occupancy, coord, TSL.vec4(density, gradient.length(), c.a.mul(c.r.add(c.g, c.b)), 1))
    }, 'Fluid / Occupancy + interface metrics')

    this.lightNode = compute3D(spec.light, () => {
      const coord = id(), p = lightUv()
      const extinction = TSL.vec3(this.carrierExtinction as any).mul(.3).toVar()
      TSL.Loop(12, ({ i }: any) => {
        const t = TSL.float(i).add(.5).div(12)
        const sampleUV = TSL.vec3(p).add(TSL.vec3(this.lightDirection as any).mul(t).mul(.62)).clamp(.001, .999)
        const c = tex(this.concentrationState, sampleUV)
        const sigmaA = TSL.vec3(
          c.r.mul(2.4).add(c.g.mul(.22), c.b.mul(.12), c.a.mul(.32)),
          c.r.mul(.26).add(c.g.mul(2.2), c.b.mul(.1), c.a.mul(1.1)),
          c.r.mul(.16).add(c.g.mul(.32), c.b.mul(.09), c.a.mul(2.55)),
        )
        const sigmaS = TSL.vec3(
          c.r.mul(.08).add(c.g.mul(.12), c.b.mul(1.2), c.a.mul(.34)),
          c.r.mul(.14).add(c.g.mul(.07), c.b.mul(1.3), c.a.mul(.24)),
          c.r.mul(.18).add(c.g.mul(.14), c.b.mul(1.24), c.a.mul(.08)),
        )
        extinction.addAssign(sigmaA.add(sigmaS).mul(.065))
      })
      store(this.transmittance, coord, TSL.vec4(extinction.negate().exp(), 1))
    }, 'Fluid / Colored light-space transmittance')

    this.computeNodes = [
      ...this.clearNodes, this.emitterVelocityNode, this.emitterSpeciesNode, this.curlNode, this.vorticityNode,
      this.divergenceNode, this.pressureAB, this.pressureBA, this.projectNode, this.velocityForwardNode,
      this.velocityBackNode, this.velocityCorrectNode, this.speciesForwardNode, this.speciesBackNode,
      this.speciesCorrectNode, this.temperatureNode, this.occupancyNode, this.lightNode,
    ]

    const volume = TSL.Fn(() => {
      const radiance = TSL.vec3(0).toVar()
      const throughput = TSL.vec3(1).toVar()
      const volumeTexture = TSL.texture3D(this.concentrationState as any, null, 0) as any
      const lightTexture = TSL.texture3D(this.transmittance as any, null, 0) as any
      const velocityTexture = TSL.texture3D(this.velocityState as any, null, 0) as any
      const curlTexture = TSL.texture3D(this.curl as any, null, 0) as any
      const pressureTexture = TSL.texture3D(this.pressureA as any, null, 0) as any
      const temperatureTexture = TSL.texture3D(this.temperatureState as any, null, 0) as any
      const occupancyTexture = TSL.texture3D(this.occupancy as any, null, 0) as any
      const stepLength = TSL.float(3.2 / spec.march)
      const pixel = TSL.screenCoordinate.xy
      const spatialJitter = TSL.vec3(
        TSL.interleavedGradientNoise(pixel),
        TSL.interleavedGradientNoise(pixel.add(TSL.vec2(19.17, 7.31))),
        TSL.interleavedGradientNoise(pixel.add(TSL.vec2(41.73, 29.11))),
      ).sub(.5).mul(.42 / spec.march)

      RaymarchingBox(TSL.float(spec.march), ({ positionRay }: any) => {
        // Stable sampling is deliberate here. A frame-varying 3D offset made the
        // entire volume shimmer because there is no temporal accumulation pass.
        const sampleUV = TSL.vec3(positionRay).add(.5, spatialJitter).clamp(.001, .999)
        const c = volumeTexture.sample(sampleUV)
        const density = c.r.add(c.g, c.b, c.a)
        const occupancy = occupancyTexture.sample(sampleUV)
        TSL.If(density.greaterThanEqual(.00035).or((this.carrierFill as any).greaterThanEqual(.5)), () => {
        const sigmaA = TSL.vec3(
          c.r.mul(2.4).add(c.g.mul(.22), c.b.mul(.12), c.a.mul(.32)),
          c.r.mul(.26).add(c.g.mul(2.2), c.b.mul(.1), c.a.mul(1.1)),
          c.r.mul(.16).add(c.g.mul(.32), c.b.mul(.09), c.a.mul(2.55)),
        ).add(this.carrierExtinction as any)
        const sigmaS = TSL.vec3(
          c.r.mul(.08).add(c.g.mul(.12), c.b.mul(1.2), c.a.mul(.34)),
          c.r.mul(.14).add(c.g.mul(.07), c.b.mul(1.3), c.a.mul(.24)),
          c.r.mul(.18).add(c.g.mul(.14), c.b.mul(1.24), c.a.mul(.08)),
        ).add(this.carrierScattering as any)
        const sigmaT = sigmaA.add(sigmaS).mul(this.opticalThickness as any)
        const stepTransmittance = sigmaT.mul(stepLength).negate().exp()
        const absorbed = stepTransmittance.oneMinus()
        const albedo = sigmaS.div(sigmaT.max(.0001))
        const shadow = lightTexture.sample(sampleUV).rgb

        const gx = volumeTexture.sample(sampleUV.add(TSL.vec3(1 / spec.species, 0, 0))).dot(TSL.vec4(1)).sub(volumeTexture.sample(sampleUV.add(TSL.vec3(-1 / spec.species, 0, 0))).dot(TSL.vec4(1)))
        const gy = volumeTexture.sample(sampleUV.add(TSL.vec3(0, 1 / spec.species, 0))).dot(TSL.vec4(1)).sub(volumeTexture.sample(sampleUV.add(TSL.vec3(0, -1 / spec.species, 0))).dot(TSL.vec4(1)))
        const gz = volumeTexture.sample(sampleUV.add(TSL.vec3(0, 0, 1 / spec.species))).dot(TSL.vec4(1)).sub(volumeTexture.sample(sampleUV.add(TSL.vec3(0, 0, -1 / spec.species))).dot(TSL.vec4(1)))
        const normal = TSL.vec3(gx, gy, gz).add(.00001).normalize()
        const gradientStrength = TSL.vec3(gx, gy, gz).length().mul(spec.species * .045).clamp(0, 1)
        const pigment = TSL.vec3(
          c.r.mul(.04).add(c.g.mul(.9), c.b.mul(.78), c.a.mul(.95)),
          c.r.mul(.62).add(c.g.mul(.06), c.b.mul(.86), c.a.mul(.45)),
          c.r.mul(.9).add(c.g.mul(.55), c.b.mul(.98), c.a.mul(.08)),
        ).div(density.max(.0001))
        const rim = normal.dot(TSL.positionViewDirection).abs().oneMinus().pow(2)
        const phaseG = c.r.mul(.12).add(c.g.mul(.08), c.b.mul(.72), c.a.mul(.38)).div(density.max(.0001)).clamp(-.2, .82)
        const cosTheta = TSL.positionViewDirection.z.abs().clamp(0, 1)
        const hgDenom = TSL.float(1).add(phaseG.mul(phaseG), phaseG.mul(cosTheta).mul(-2)).max(.001).pow(1.5)
        const phase = TSL.float(1).sub(phaseG.mul(phaseG)).div(hgDenom).mul(.0796)
        const pearl = normal.dot(TSL.vec3(this.lightDirection as any)).abs().pow(18).mul(c.a).mul(.8)
        const emission = TSL.vec3(.18, .012, .5).mul(c.g.mul(c.a).mul(this.edgeGlow as any)).add(TSL.vec3(1, .42, .05).mul(pearl))
        const keyShape = normal.dot(TSL.vec3(this.lightDirection as any)).mul(.5).add(.5).pow(2)
        const multipleScattering = pigment.mul(density.min(1)).mul(
          rim.mul(this.edgeGlow as any).mul(.32).add(gradientStrength.mul(keyShape).mul(.28), .055),
        )
        const displayGain = TSL.select(density.lessThan(.0001), TSL.float(1), c.dot(TSL.vec4(1, .9, .3, .65)).div(density.max(.0001)))
        const incoming = shadow.mul(albedo).mul(phase.mul(7).add(.08)).mul(this.lightEnergy as any).add(emission, multipleScattering).mul(displayGain)
        radiance.addAssign(throughput.mul(absorbed).mul(incoming))
        throughput.mulAssign(stepTransmittance)

        const pressure = pressureTexture.sample(sampleUV).r
        const debug = TSL.vec3(0).toVar()
        TSL.If((this.debugMode as any).equal(1), () => { debug.assign(TSL.vec3(c.r.add(c.a), c.g.add(c.b), c.b.add(c.a.mul(.25))).div(density.max(.0001))) })
        TSL.If((this.debugMode as any).equal(2), () => { debug.assign(TSL.vec3(density.mul(.65))) })
        TSL.If((this.debugMode as any).equal(3), () => { debug.assign(velocityTexture.sample(sampleUV).xyz.abs().mul(.38)) })
        TSL.If((this.debugMode as any).equal(4), () => { debug.assign(curlTexture.sample(sampleUV).xyz.abs().mul(.13)) })
        TSL.If((this.debugMode as any).equal(5), () => { debug.assign(TSL.vec3(pressure.max(0), 0, pressure.negate().max(0)).mul(.7)) })
        TSL.If((this.debugMode as any).equal(6), () => { debug.assign(TSL.vec3(temperatureTexture.sample(sampleUV).r, .08, temperatureTexture.sample(sampleUV).r.oneMinus().mul(.4))) })
        TSL.If((this.debugMode as any).equal(7), () => { debug.assign(TSL.vec3(occupancy.r, occupancy.g, occupancy.b)) })
        TSL.If((this.debugMode as any).equal(8), () => { debug.assign(shadow) })
        TSL.If((this.debugMode as any).equal(9), () => { debug.assign(normal.mul(.5).add(.5)) })
        TSL.If((this.debugMode as any).equal(10), () => { debug.assign(TSL.vec3(occupancy.b.mul(2), .04, occupancy.b.mul(.2))) })
        TSL.If((this.debugMode as any).equal(11), () => { debug.assign(TSL.vec3(this.audioDebug as any)) })
        TSL.If((this.debugMode as any).equal(12), () => {
          const onBound = TSL.vec3(sampleUV).sub(this.emitter as any).length().sub(this.ringRadius as any).abs().lessThan(.025)
          debug.assign(TSL.select(onBound, TSL.vec3(1, .3, .05), TSL.vec3(.015)))
        })
        TSL.If((this.debugMode as any).greaterThan(0), () => {
          radiance.assign(debug.mul(density.min(1)))
          throughput.assign(TSL.vec3(density.mul(-.35).exp()))
        })
        TSL.If(throughput.r.max(throughput.g, throughput.b).lessThan(.012), () => { TSL.Break() })
        })
      })
      const alpha = TSL.float(1).sub(throughput.r.add(throughput.g, throughput.b).div(3)).clamp(0, 1)
      // The linear in-scattered radiance is intentionally lifted before the
      // renderer's tone map; otherwise the dark studio background compresses
      // the fluid into a barely visible blue haze.
      return TSL.vec4(radiance.mul(this.exposure as any).mul(2.65), alpha)
    })()

    const material = new THREE.NodeMaterial()
    material.name = 'VOLUMA / Dual-resolution Beer-Lambert Volume'
    // Raymarching produces premultiplied volume color and alpha as one result.
    // Feed it directly to the fragment output so it is not routed through the
    // generic diffuse-lighting path (which can discard the alpha contribution
    // for an unlit NodeMaterial on WebGPU).
    material.fragmentNode = volume
    material.side = THREE.BackSide
    material.transparent = true
    material.premultipliedAlpha = true
    material.depthWrite = false
    material.depthTest = true
    material.toneMapped = true
    this.material = material
  }

  initialize(renderer: Renderer) {
    if (this.initialized || this.disposed) return
    this.clearNodes.forEach(node => renderer.compute(node))
    renderer.compute(this.occupancyNode)
    renderer.compute(this.lightNode)
    this.initialized = true
  }

  queueEmitter(point = new THREE.Vector3(.5, .78, .5)) {
    this.emitter.value.copy(point)
    this.interactionMass.value = 1
    this.interactionImpulse.value.set(0, 0, 0)
    this.interactionPull.value = 0
    this.queued = true
  }

  queueInteraction(point: THREE.Vector3, delta: THREE.Vector3, mode: string) {
    this.emitter.value.copy(point)
    this.interactionMass.value = mode === 'inject' ? 1 : mode === 'vortex' ? .25 : 0
    this.interactionImpulse.value.copy(delta).multiplyScalar(mode === 'stir' ? 30 : mode === 'inject' ? 14 : 4)
    this.interactionPull.value = mode === 'pull' ? -2.8 : mode === 'vortex' ? 1.35 : 0
    this.queued = true
  }

  configure(values: { carrier: string; species: string; emitterPattern: string; debugView: string; thickness: number; glow: number; swirl: number; audio: number; bass: number; mid: number; treble: number; flux: number; vorticity: number; viscosity: number; buoyancy: number; diffusion: number; pressure: number; mass: number; circulation: number; radius: number; exposure: number; lightAzimuth: number; lightElevation: number; lightIntensity: number }) {
    const carrier = CARRIER[values.carrier] ?? CARRIER['clear-water']
    this.species.value.copy(SPECIES_VECTOR[values.species] ?? SPECIES_VECTOR['cyan-ink'])
    this.emitterPattern = values.emitterPattern
    this.emitterShape.value = values.emitterPattern === 'twin' || values.emitterPattern === 'spectrum' || values.emitterPattern === 'tendril' || values.emitterPattern === 'downward' ? 1 : values.emitterPattern === 'ribbon' ? 2 : values.emitterPattern === 'fog' ? 3 : 0
    this.opticalThickness.value = values.thickness * 1.55
    this.edgeGlow.value = values.glow
    this.debugMode.value = DEBUG_MODE[values.debugView] ?? 0
    this.vorticity.value = values.vorticity * (.68 + values.swirl * .7) + values.treble * values.audio * 1.8 + values.flux * .7
    this.viscosity.value = values.viscosity
    this.carrierViscosity.value = carrier.viscosity
    this.carrierDamping.value = carrier.damping
    this.carrierBuoyancy.value = carrier.buoyancy
    this.carrierExtinction.value.copy(carrier.extinction)
    this.carrierScattering.value.copy(carrier.scattering)
    this.carrierFill.value = values.carrier.includes('mist') || values.carrier.includes('fog') || values.carrier.includes('smoke') ? 1 : 0
    this.surfaceTension.value = carrier.surfaceTension
    this.buoyancy.value = values.buoyancy
    this.diffusion.value = values.diffusion
    this.pressureIterations = Math.max(6, Math.min(this.maxPressureIterations, Math.round(values.pressure)))
    this.mass.value = values.mass * (1 + values.bass * values.audio * .9)
    this.circulation.value = values.circulation * (.72 + values.swirl * .62 + values.bass * values.audio * .4 + values.mid * .18)
    this.ringRadius.value = values.radius * .22 * (1 + values.bass * values.audio * .24)
    const azimuth = THREE.MathUtils.degToRad(values.lightAzimuth)
    const elevation = THREE.MathUtils.degToRad(values.lightElevation)
    this.lightDirection.value.set(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth)).normalize()
    this.lightEnergy.value = values.lightIntensity
    this.exposure.value = values.exposure
    this.audioDebug.value.set(values.bass, values.mid, values.treble)
  }

  private scheduleEmitter() {
    const phase = this.emissionIndex++
    let interval = 7.5
    switch (this.emitterPattern) {
      case 'twin':
        this.emitter.value.set(phase % 2 ? .62 : .38, .8, .5)
        this.species.value.copy(phase % 2 ? SPECIES_VECTOR['magenta-dye'] : SPECIES_VECTOR['cyan-ink'])
        interval = .82
        break
      case 'downward':
        this.emitter.value.set(.5 + Math.sin(phase * 2.2) * .16, .86, .5)
        interval = 1.12
        break
      case 'orbit': {
        const angle = phase * 1.16
        this.emitter.value.set(.5 + Math.cos(angle) * .19, .56 + Math.sin(angle * .5) * .16, .5 + Math.sin(angle) * .2)
        interval = .44
        break
      }
      case 'ribbon':
        this.emitter.value.set(.5 + Math.sin(phase * .72) * .28, .72, .5 + Math.cos(phase * .44) * .12)
        this.species.value.copy(SPECIES_VECTOR['pearl-lacquer'])
        interval = .52
        break
      case 'spectrum':
        this.emitter.value.set(.28 + (phase % 3) * .22, .78 - (phase % 2) * .16, .5)
        this.species.value.copy([SPECIES_VECTOR['cyan-ink'], SPECIES_VECTOR['magenta-dye'], SPECIES_VECTOR['neon-orchid']][phase % 3])
        interval = .36
        break
      case 'fog':
        this.emitter.value.set(.2 + ((phase * .37) % .6), .18, .28 + ((phase * .23) % .44))
        this.species.value.copy(SPECIES_VECTOR.smoke)
        interval = .28
        break
      case 'tendril':
        this.emitter.value.set(.5 + Math.sin(phase * .31) * .08, .82, .5 + Math.cos(phase * .39) * .08)
        interval = .23
        break
      default:
        this.emitter.value.set(.5, .8, .5)
    }
    this.nextEmission = this.elapsed + interval
    this.queued = true
  }

  private runSubstep(renderer: Renderer, emit: boolean) {
    this.emit.value = emit ? 1 : 0
    renderer.compute(this.emitterVelocityNode)
    renderer.compute(this.emitterSpeciesNode)
    this.emit.value = 0
    renderer.compute(this.curlNode)
    renderer.compute(this.vorticityNode)
    renderer.compute(this.divergenceNode)
    const pairs = Math.ceil(this.pressureIterations / 2)
    for (let index = 0; index < pairs; index++) {
      renderer.compute(this.pressureAB)
      renderer.compute(this.pressureBA)
    }
    renderer.compute(this.projectNode)
    renderer.compute(this.velocityForwardNode)
    renderer.compute(this.velocityBackNode)
    renderer.compute(this.velocityCorrectNode)
    renderer.compute(this.speciesForwardNode)
    renderer.compute(this.speciesBackNode)
    renderer.compute(this.speciesCorrectNode)
    renderer.compute(this.temperatureNode)
  }

  step(renderer: Renderer, delta: number, playing: boolean, emitterEnabled: boolean) {
    if (!this.initialized || this.disposed || !playing) return null
    this.simulationAccumulator += Math.min(delta, 1 / 20)
    if (this.simulationAccumulator < 1 / 30) return null
    const started = performance.now()
    const clampedDelta = Math.min(this.simulationAccumulator, 1 / 24)
    this.simulationAccumulator = 0
    const substeps = clampedDelta > 1 / 38 ? 2 : 1
    this.dt.value = clampedDelta / substeps
    this.elapsed += clampedDelta
    if (this.elapsed >= this.nextEmission) {
      this.scheduleEmitter()
    }
    const emit = this.queued && emitterEnabled
    for (let index = 0; index < substeps; index++) this.runSubstep(renderer, emit && index === 0)
    this.interactionMass.value = 1
    this.interactionImpulse.value.set(0, 0, 0)
    this.interactionPull.value = 0
    this.queued = false
    renderer.compute(this.occupancyNode)
    const bakeStarted = performance.now()
    renderer.compute(this.lightNode)
    const finished = performance.now()
    return { simMs: bakeStarted - started, bakeMs: finished - bakeStarted, pressureIterations: this.pressureIterations, substeps }
  }

  reset(renderer: Renderer) {
    this.clearNodes.forEach(node => renderer.compute(node))
    renderer.compute(this.occupancyNode)
    renderer.compute(this.lightNode)
    this.queueEmitter()
    this.nextEmission = this.emitterPattern === 'single' ? this.elapsed + 7.5 : this.elapsed + .15
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    ;[
      this.velocityState, this.velocityWork, this.velocityForward, this.velocityBack,
      this.concentrationState, this.concentrationEmitted, this.concentrationForward, this.concentrationBack,
      this.temperatureState, this.temperatureWork, this.pressureA, this.pressureB, this.divergence,
      this.curl, this.obstacle, this.occupancy, this.transmittance,
    ].forEach(texture => texture.dispose())
    this.computeNodes.forEach(node => node.dispose?.())
    this.material.dispose()
  }
}

export function VolumetricFluid({ definitions }: { definitions: FluidRuntimeDefinitions }) {
  const renderer = useThree(state => state.gl) as unknown as Renderer
  const runtime = useArtinosRuntime()
  const carrier = useResolvedParameterRef(definitions.carrier.id, 'clear-water')
  const quality = useResolvedParameter(definitions.quality, 80)
  const playing = useResolvedParameterRef(definitions.playing.id, true)
  const emitterEnabled = useResolvedParameterRef(definitions.emitterEnabled.id, true)
  const interaction = useResolvedParameterRef(definitions.interaction.id, 'vortex')
  const debugView = useResolvedParameterRef(definitions.debugView.id, 'beauty')
  const species = useResolvedParameterRef(definitions.species.id, 'cyan-ink')
  const emitterPattern = useResolvedParameterRef(definitions.emitterPattern.id, 'single')
  const thickness = useResolvedParameterRef(definitions.thickness.id, .72)
  const swirl = useResolvedParameterRef(definitions.swirl.id, .64)
  const glow = useResolvedParameterRef(definitions.glow.id, .36)
  const audio = useResolvedParameterRef(definitions.audio.id, .58)
  const bass = useSignal('audio.bass', 0)
  const mid = useSignal('audio.mid', 0)
  const treble = useSignal('audio.treble', 0)
  const flux = useSignal('audio.flux', 0)
  const vorticity = useResolvedParameterRef(definitions.vorticity.id, 1.85)
  const viscosity = useResolvedParameterRef(definitions.viscosity.id, .16)
  const buoyancy = useResolvedParameterRef(definitions.buoyancy.id, -.45)
  const diffusion = useResolvedParameterRef(definitions.diffusion.id, .012)
  const pressure = useResolvedParameterRef(definitions.pressure.id, 20)
  const mass = useResolvedParameterRef(definitions.emitterMass.id, 1.1)
  const circulation = useResolvedParameterRef(definitions.circulation.id, 2.2)
  const radius = useResolvedParameterRef(definitions.radius.id, .48)
  const exposure = useResolvedParameterRef(definitions.exposure.id, 1.1)
  const lightAzimuth = useResolvedParameterRef(definitions.lightAzimuth.id, 26)
  const lightElevation = useResolvedParameterRef(definitions.lightElevation.id, 38)
  const lightIntensity = useResolvedParameterRef(definitions.lightIntensity.id, 1.35)
  const tier = QUALITY[String(quality)] ?? QUALITY.draft
  const engine = useMemo(() => new VolumetricFluidPipeline(tier), [tier])
  const engineRef = useRef(engine)
  const disposeTimer = useRef<number | undefined>(undefined)
  const telemetryFrame = useRef(0)
  const dragging = useRef(false)
  const lastPoint = useRef(new THREE.Vector3())
  engineRef.current = engine

  useEffect(() => {
    if (disposeTimer.current !== undefined) window.clearTimeout(disposeTimer.current)
    engine.initialize(renderer)
    engine.queueEmitter()
    const remove = runtime.resources.set('voluma.pipeline', engine, { kind: 'dual-resolution-webgpu-fluid-pipeline', owner: 'voluma' })
    runtime.telemetry.set('fluid.resolution', `${engine.velocitySize}³ → ${engine.speciesSize}³`, { group: 'fluid' })
    runtime.telemetry.set('fluid.lightResolution', `${engine.lightSize}³`, { group: 'fluid' })
    runtime.telemetry.set('fluid.backend', 'TSL compute / WebGPU', { group: 'fluid' })
    return () => {
      remove()
      disposeTimer.current = window.setTimeout(() => engine.dispose(), 0)
    }
  }, [engine, renderer, runtime])

  useFrame((_state, delta) => {
    engine.configure({
      carrier: String(carrier.current), species: String(species.current), emitterPattern: String(emitterPattern.current), debugView: String(debugView.current),
      thickness: Number(thickness.current), glow: Number(glow.current), swirl: Number(swirl.current), audio: Number(audio.current),
      bass: Number(bass), mid: Number(mid), treble: Number(treble), flux: Number(flux), vorticity: Number(vorticity.current),
      viscosity: Number(viscosity.current), buoyancy: Number(buoyancy.current), diffusion: Number(diffusion.current),
      pressure: Number(pressure.current), mass: Number(mass.current), circulation: Number(circulation.current), radius: Number(radius.current),
      exposure: Number(exposure.current), lightAzimuth: Number(lightAzimuth.current), lightElevation: Number(lightElevation.current), lightIntensity: Number(lightIntensity.current),
    })
    const stats = engine.step(renderer, delta, Boolean(playing.current), Boolean(emitterEnabled.current))
    if (stats && ++telemetryFrame.current % 12 === 0) {
      runtime.telemetry.set('fluid.sim.ms', stats.simMs, { group: 'fluid', unit: 'ms' })
      runtime.telemetry.set('fluid.bake.ms', stats.bakeMs, { group: 'fluid', unit: 'ms' })
      runtime.telemetry.set('fluid.pressure.iterations', stats.pressureIterations, { group: 'fluid' })
      runtime.telemetry.set('fluid.substeps', stats.substeps, { group: 'fluid' })
    }
  }, -1)

  const localPoint = (event: ThreeEvent<PointerEvent>) => {
    const local = event.object.worldToLocal(event.point.clone())
    return new THREE.Vector3(local.x + .5, local.y + .5, local.z + .5).clampScalar(.025, .975)
  }
  const modeFor = (event: ThreeEvent<PointerEvent>) => event.nativeEvent.shiftKey ? 'inject' : event.nativeEvent.altKey ? 'vortex' : event.nativeEvent.ctrlKey ? 'pull' : String(interaction.current)
  const beginInteraction = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    dragging.current = true
    const point = localPoint(event)
    lastPoint.current.copy(point)
    engineRef.current.queueInteraction(point, new THREE.Vector3(0, -.02, 0), modeFor(event))
  }
  const moveInteraction = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    event.stopPropagation()
    const point = localPoint(event)
    const delta = point.clone().sub(lastPoint.current)
    if (delta.lengthSq() < .000018) return
    lastPoint.current.copy(point)
    engineRef.current.queueInteraction(point, delta, modeFor(event))
  }

  return <mesh name="Dual-resolution Eulerian Volumetric Fluid" material={engine.material} onPointerDown={beginInteraction} onPointerMove={moveInteraction} onPointerUp={() => { dragging.current = false }} onPointerLeave={() => { dragging.current = false }} scale={[4.8, 3.8, 2.8]}>
    <boxGeometry args={[1, 1, 1]} />
  </mesh>
}
