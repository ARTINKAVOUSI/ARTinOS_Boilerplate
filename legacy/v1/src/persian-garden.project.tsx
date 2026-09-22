import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@artinos/modules/drei'
import { defineArtinosProject } from '@artinos/r3f'
import { useArtinosRuntime } from '@artinos/runtime'
// three/webgpu, not bare `three`: the renderer this project runs on is
// WebGPURenderer, and PMREMGenerator must come from the same build to accept it.
import { AdditiveBlending, EquirectangularReflectionMapping, PMREMGenerator, SRGBColorSpace, type Mesh, type PointLight, type Texture } from 'three/webgpu'
import type { GraphDefinition } from '@artinos/graph'
import type { ParameterDefinition } from '@artinos/runtime'

/**
 * Persian Garden — a semantic scene rather than a shader demo.
 *
 * Three real elements with real relationships: an environment that lights the
 * scene, water that reflects what is above it, and an orb that hovers and is
 * mirrored in that water. Every parameter the Inspector exposes changes
 * something you can see, which is what makes it useful as a boilerplate — the
 * previous example rendered a floating icosahedron over nothing.
 */

/* ── environment ────────────────────────────────────────────────────────── */

/**
 * The courtyard photograph, used as both backdrop and light source.
 *
 * It is a PNG, not a .hdr, so drei's `<Environment files>` cannot load it —
 * that path picks a loader by extension and would reach for RGBELoader. The
 * texture is loaded directly and mapped equirectangularly instead, which also
 * lets the same image serve `background` and `environment` without decoding
 * it twice.
 */
function GardenEnvironment() {
  const scene = useThree(state => state.scene)
  const renderer = useThree(state => state.gl)
  const runtime = useArtinosRuntime()
  const texture = useTexture('/hdr/persianbeauty.png')

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true

    const previousBackground = scene.background
    const previousEnvironment = scene.environment

    // NOTE: the backdrop is drawn by <GardenBackdrop>, not from here.
    //
    // `scene.background` with a plain texture uses COVER fit — it fills the
    // viewport and crops whatever overflows. The photo is 16:9 and the viewport
    // is usually taller, so it cropped into the central arch and cut the pool
    // off the bottom entirely. That is why the backdrop never looked like the
    // source image. A quad sized to CONTAIN the photo is used instead.
    scene.background = null
    scene.backgroundBlurriness = 0

    // Lighting still wants a spherical map, so a separate equirect COPY feeds
    // the PMREM. Treating a flat photo as a panorama is wrong for the backdrop
    // but perfectly serviceable as an ambient light probe — it only has to
    // supply plausible colour and direction to the reflections.
    const probe = texture.clone()
    probe.mapping = EquirectangularReflectionMapping
    probe.colorSpace = SRGBColorSpace
    probe.needsUpdate = true

    const pmrem = new PMREMGenerator(renderer as never)
    let envMap: Texture | null = null
    try {
      envMap = pmrem.fromEquirectangular(probe).texture
    } catch {
      envMap = probe
    }
    scene.environment = envMap

    return () => {
      scene.background = previousBackground
      scene.environment = previousEnvironment
      if (envMap && envMap !== probe) envMap.dispose()
      probe.dispose()
      pmrem.dispose()
    }
  }, [scene, renderer, texture])

  // Intensity and rotation are parameters, so the backdrop can be pushed back
  // behind the subject without touching the file. Blurriness is applied only
  // when the environment is PMREM-backed, which is the case above.
  useFrame(() => {
    const intensity = Number(runtime.parameters.get('garden.env.intensity') ?? 1)
    // Backdrop brightness is separated from light intensity: the photo should
    // hold its exposure while the reflections are dialled independently.
    scene.backgroundIntensity = Number(runtime.parameters.get('garden.env.backdrop') ?? 1)
    scene.environmentIntensity = intensity
    // No blurriness and no rotation here — both are properties of a spherical
    // background, and this one is a flat image. Applying either re-introduces
    // the wrapped look the equirect mapping produced.
    scene.environmentRotation.y = Number(runtime.parameters.get('garden.env.rotation') ?? 0)
  })

  return null
}

/* ── backdrop ───────────────────────────────────────────────────────────── */

/**
 * The photograph, shown whole.
 *
 * Drawn as a camera-facing quad rather than via `scene.background`, because
 * that path only does COVER fit: it scales the image to fill the viewport and
 * crops the rest. At 16:9 against a taller viewport that meant cropping into
 * the central arch and losing the pool completely — the image was loading
 * correctly all along, it was being cropped.
 *
 * This sizes the quad to CONTAIN the photo inside the frustum, so the full
 * frame is always visible whatever the window aspect.
 */
const BACKDROP_DISTANCE = 46

/**
 * Where the photograph currently sits in the frustum, written by the backdrop
 * each frame and read by the orb.
 *
 * The orb has to hover over the pool IN THE PHOTO, and that pool moves as the
 * window aspect changes the contain-fit. Anchoring the orb to a hard-coded
 * world position could only ever line up at one window size — which is why it
 * kept drifting off the water. Sharing the measured layout makes the alignment
 * hold at any aspect.
 */
const backdropLayout = { heightFraction: 1 }

/** Vertical position of features in the photo, as a fraction from its top. */
const POOL_SURFACE = 0.7

/** How far in front of the camera the orb sits. */
const ORB_DISTANCE = 8

function GardenBackdrop() {
  const camera = useThree(state => state.camera)
  const size = useThree(state => state.size)
  const texture = useTexture('/hdr/persianbeauty.png')
  const mesh = useRef<Mesh>(null)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  useFrame(() => {
    if (!mesh.current) return

    const perspective = camera as typeof camera & { fov?: number }
    const fov = perspective.fov ?? 40
    const frustumHeight = 2 * BACKDROP_DISTANCE * Math.tan((fov * Math.PI) / 360)
    const frustumWidth = frustumHeight * (size.width / Math.max(1, size.height))

    const image = texture.image as { width?: number; height?: number } | undefined
    const imageAspect = image?.width && image?.height ? image.width / image.height : 1672 / 941

    // Contain: fit to width, and only fall back to height if that would
    // overflow — so nothing is ever cropped off the photograph.
    let width = frustumWidth
    let height = width / imageAspect
    if (height > frustumHeight) {
      height = frustumHeight
      width = height * imageAspect
    }

    // Publish how much of the frustum the photo actually occupies, so the orb
    // can be placed relative to the image rather than to the window.
    backdropLayout.heightFraction = height / frustumHeight

    mesh.current.scale.set(width, height, 1)
    // Billboarded to the camera and pinned at a fixed distance, so it behaves
    // as a backdrop rather than an object in the scene.
    mesh.current.quaternion.copy(camera.quaternion)
    mesh.current.position
      .set(0, 0, -BACKDROP_DISTANCE)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
  })

  return (
    <mesh ref={mesh} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      {/* Unlit and untone-mapped: this is a finished photograph, so it should
          be reproduced, not re-lit or re-graded. */}
      <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

/* ── camera ─────────────────────────────────────────────────────────────── */

/**
 * The camera is set here, not through `camera.preset`.
 *
 * Compositing 3D over a photograph only works when the render camera matches
 * the lens the photo was shot on. The preset system cannot express that: only
 * `camera.target` is exposed as a parameter, and `position` comes from a fixed
 * preset table — so the shot could only ever be approximated by moving the aim
 * point, which is why every earlier attempt at framing missed.
 *
 * The photograph is a near-level view down a corridor: its vanishing point
 * sits close to the middle of the frame, and the pool runs from there to the
 * bottom edge. A level camera reproduces that exactly — with the waterline at
 * y = 0, water at infinite distance lands on the horizon and near water falls
 * to the bottom of frame, matching the photo's perspective without guesswork.
 *
 * Runs at a late priority so it wins against the managed camera, which writes
 * its own transform every frame.
 */
const CAMERA_HEIGHT = 0
const CAMERA_DISTANCE = 0

function GardenCamera() {
  const camera = useThree(state => state.camera)

  useFrame(() => {
    // Dead level at the origin. The scene is composed in the camera's own
    // space — the backdrop is billboarded to it and the orb is anchored to the
    // photo — so the camera itself only has to be a stable, unrotated frame of
    // reference. Moving it just slid the whole composition around together.
    camera.position.set(0, 0, 0)
    camera.lookAt(0, 0, -1)
    const perspective = camera as typeof camera & { fov?: number }
    if (perspective.fov !== undefined && perspective.fov !== 40) {
      perspective.fov = 40
      camera.updateProjectionMatrix()
    }
    // Default priority on purpose. A `useFrame` priority above 0 makes R3F hand
    // the render loop to the caller — nothing draws until you call gl.render()
    // yourself, which blanks the canvas. Ordering is handled by mount order
    // instead: this sits inside Content, below RuntimeStage's camera, so it
    // runs after and its transform is the one that survives the frame.
  })

  return null
}

/* ── orb ────────────────────────────────────────────────────────────────── */

/**
 * The subject. Hovers, breathes with its energy parameter, and carries a
 * point light so it actually contributes to the water beneath it instead of
 * only being lit by the environment.
 */
function HoverOrb() {
  const runtime = useArtinosRuntime()
  const mesh = useRef<Mesh>(null)
  const reflection = useRef<Mesh>(null)
  const light = useRef<PointLight>(null)

  // The hover clock is kept locally: this fiber version's frame state does not
  // expose `clock`, and accumulating delta is equivalent for a sine.
  const elapsed = useRef(0)

  useFrame((state, delta) => {
    if (!mesh.current) return
    elapsed.current += delta
    const time = elapsed.current

    const energy = Math.max(
      0,
      Math.max(Number(runtime.signals.get('audio.bass') ?? 0), Number(runtime.parameters.get('garden.orb.energy') ?? 0)),
    )
    const hover = Number(runtime.parameters.get('garden.orb.height') ?? 2.2)
    const bob = Number(runtime.parameters.get('garden.orb.bob') ?? 0.12)

    // Anchor to the photograph, not to world space.
    //
    // The orb sits ORB_DISTANCE in front of the camera; at that depth the
    // frustum is `span` tall. The photo occupies `heightFraction` of the
    // frustum, so the waterline — POOL_SURFACE down the image — lands at this
    // offset from centre. Everything is expressed against the image, so the
    // orb stays on the water at any window aspect.
    const perspective = state.camera as typeof state.camera & { fov?: number }
    const fov = perspective.fov ?? 40
    const span = 2 * ORB_DISTANCE * Math.tan((fov * Math.PI) / 360)
    const waterline = (0.5 - POOL_SURFACE) * span * backdropLayout.heightFraction

    const radius = 0.055 * span
    const lift = hover * radius
    const y = waterline + lift + Math.sin(time * 0.7) * bob * radius

    const scale = (1 + energy * 0.28) * radius
    mesh.current.position.set(0, y, -ORB_DISTANCE)
    mesh.current.rotation.y += delta * (0.12 + energy * 0.3)
    mesh.current.scale.setScalar(scale)

    // The twin is the orb mirrored through the waterline. Because it reads the
    // same values every frame it tracks the hover and the pulse exactly — the
    // thing a faked static reflection always gets wrong.
    if (reflection.current) {
      reflection.current.position.set(0, waterline - (y - waterline), -ORB_DISTANCE)
      reflection.current.rotation.y = mesh.current.rotation.y
      reflection.current.scale.set(scale, -scale * 0.75, scale)
    }

    if (light.current) {
      light.current.position.set(0, y, -ORB_DISTANCE)
      light.current.intensity = 1.1 + energy * 3.2
    }
  })

  return (
    <group>
      <mesh ref={mesh} castShadow>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhysicalMaterial
          color="#8fe8d6"
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.06}
          transmission={0.35}
          thickness={1.1}
          ior={1.4}
          emissive="#3ec3a8"
          emissiveIntensity={0.16}
        />
      </mesh>

      {/* The reflection in the photographed water.
          With no surface geometry beneath it, this mesh IS the reflection, so
          it has to behave like one: dimmer than the source, flattened
          vertically the way a reflection compresses on a near-horizontal
          surface, and additively blended so it sits in the water rather than
          occluding it. Non-physical on purpose — it must not cast shadows or
          pick up the environment a second time. */}
      <mesh ref={reflection} scale={[1, -0.75, 1]}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#2f7f72"
          transparent
          opacity={0.45}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Bounced light into the pool, so the orb is present in the water even
          where the surface is too rough to resolve a reflection. */}
      <pointLight ref={light} color="#7fe3d4" intensity={1.1} distance={9} decay={2} />
    </group>
  )
}

/* ── content ────────────────────────────────────────────────────────────── */

function Content() {
  if (new URLSearchParams(location.search).has('fail-startup')) {
    throw new Error('Forced startup failure for recovery verification')
  }
  return (
    <group>
      <GardenEnvironment />
      <GardenCamera />
      <GardenBackdrop />
      <HoverOrb />
      {/* No water plane and no petal geometry.
          The photograph already contains a pool, tiling and fallen petals, all
          with correct perspective. Laying a 3D plane over them only works if
          the render camera matches the lens the photo was shot on — it does
          not, so the plane read as a grey sheet pasted across the courtyard
          and the petals floated off the surface. The scene contributes the one
          thing the photo cannot: an orb, and its reflection in that water. */}
      {/* A warm key from the courtyard's sun side, and a cool fill from the
          tiled wall opposite, so the orb reads as sitting IN the photograph
          rather than pasted over it. */}
      <directionalLight position={[3.5, 6, -2.5]} intensity={0.55} color="#ffd9a8" castShadow />
      <directionalLight position={[-4, 2.5, 3]} intensity={0.2} color="#8fb8d9" />
      <ambientLight intensity={0.08} />
    </group>
  )
}

/* ── parameters ─────────────────────────────────────────────────────────── */

const parameters: ParameterDefinition[] = [
  { id: 'garden.orb.energy', label: 'Orb Energy', type: 'number', defaultValue: 0, min: 0, max: 1.5, step: 0.01, group: 'Orb', modulatable: true },
  { id: 'garden.orb.height', label: 'Hover Height', type: 'number', defaultValue: 2.2, min: 0.5, max: 6, step: 0.01, group: 'Orb' },
  { id: 'garden.orb.bob', label: 'Bob Amount', type: 'number', defaultValue: 0.12, min: 0, max: 0.6, step: 0.01, group: 'Orb' },
  { id: 'garden.env.intensity', label: 'Light Intensity', type: 'number', defaultValue: 1, min: 0, max: 3, step: 0.01, group: 'Environment' },
  { id: 'garden.env.backdrop', label: 'Backdrop Exposure', type: 'number', defaultValue: 1, min: 0, max: 2, step: 0.01, group: 'Environment' },
  { id: 'garden.env.rotation', label: 'Backdrop Rotation', type: 'number', defaultValue: 0, min: 0, max: Math.PI * 2, step: 0.01, group: 'Environment' },
]

/**
 * Audio drives the orb through a graph rather than a binding, so the Graph
 * panel opens on something real. One parameter has one writer: adding a
 * binding to `garden.orb.energy` as well would make the two fight.
 */
const orbPulse: GraphDefinition = {
  id: 'garden-pulse',
  name: 'Garden Pulse',
  domain: 'signal',
  enabled: true,
  nodes: [
    { id: 'bass', type: 'signal', x: 36, y: 36, data: { id: 'audio.bass' } },
    { id: 'settle', type: 'smooth', x: 300, y: 36, data: { amount: 0.84 } },
    { id: 'shape', type: 'remap', x: 564, y: 36, data: { inMin: 0, inMax: 1, outMin: 0, outMax: 1.2 } },
    { id: 'limit', type: 'clamp', x: 300, y: 264, data: { min: 0, max: 1.5 } },
    { id: 'drive', type: 'write-parameter', x: 564, y: 264, data: { id: 'garden.orb.energy' } },
  ],
  edges: [
    { id: 'e1', from: 'bass', to: 'settle', output: 'value', input: 'value', order: 0 },
    { id: 'e2', from: 'settle', to: 'shape', output: 'value', input: 'value', order: 0 },
    { id: 'e3', from: 'shape', to: 'limit', output: 'value', input: 'value', order: 0 },
    { id: 'e4', from: 'limit', to: 'drive', output: 'value', input: 'value', order: 0 },
  ],
}

export default defineArtinosProject({
  id: 'persian-garden',
  name: 'Persian Garden',
  version: '1.0.0',
  description: 'A reflecting pool in a Persian courtyard, with a hovering orb mirrored in the water',
  default: true,
  shell: 'studio',
  renderer: {
    backend: 'auto',
    dpr: [0.75, 2],
    shadows: true,
    postfx: true,
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
    threeInspector: true,
    threeInspectorVisible: false,
  },
  Content,
  parameters,
  graphs: [orbPulse],

  /**
   * Hand the backdrop to `GardenEnvironment`.
   *
   * `RuntimeStage` mounts its own `<Environment>` bound to `scene.environment`,
   * and it re-asserts `scene.background` every frame — so a project that sets
   * the background directly gets overwritten immediately. Its `hdr` preset is
   * not a way out either: that path is drei's `<Environment files>`, which
   * picks a loader by file extension and has no branch for `.png`.
   *
   * Setting the preset to `blank` makes that component render null, which
   * leaves the background unowned and lets the project's own equirect stand.
   * The rest of the stage — lighting, shadows, camera, tone mapping — is left
   * doing its job.
   */
  setup({ runtime }) {
    runtime.parameters.set('scene.environment', 'blank')
    // The photograph already lights the scene; a full rig would double it.
    runtime.parameters.set('scene.lighting', 'neutral')
    runtime.parameters.set('scene.shadows', 'soft')
    runtime.parameters.set('scene.ground.enabled', false)
    // Look slightly down the pool rather than at the origin, so the surface
    // and the reflection are both in frame.
    // OrbitControls owns the camera once it mounts and keeps its own target, so
    // a project-set 'camera.target' is overwritten on the first frame and the
    // framing silently ignores it. Controls off means the preset and target
    // above actually hold — this scene is a composed shot, not a turntable.
    runtime.parameters.set('camera.controls', 'none')
    runtime.parameters.set('render.exposure', 1)
    // The backdrop is a finished, graded photograph. AgX — the shipped default
    // — is a film-emulation curve meant for raw HDR output: applied on top of
    // an already-graded image it desaturates and lifts it, which is the milky
    // wash over the courtyard. `none` lets the photo through exactly as shot.
    runtime.parameters.set('render.toneMapping', 'none')

    // The stock PostFX stack ships bloom at a strength that turns an emissive
    // subject into a white smear — it erased the courtyard, the water and the
    // reflection entirely until it was turned down.
    //
    // Set as parameters rather than via `presets.apply('postfx:cinematic')`:
    // presets are registered by ProjectRuntime, and `setup` can run before that
    // happens, in which case `apply` finds nothing and returns false silently.
    runtime.parameters.set('postfx.bloom.strength', 0.5)
    runtime.parameters.set('postfx.bloom.radius', 0.28)
    runtime.parameters.set('postfx.bloom.threshold', 0.88)

    // PostFX starts OFF here, and that is not a stylistic choice.
    //
    // The pipeline composites through `pass(scene, camera)` with an MRT target
    // and does not carry `scene.background` into its output — so the moment it
    // is enabled the courtyard drops to black and the whole point of this scene
    // is lost. It is a pre-existing pipeline issue, reproducible on the old
    // example too (which is why that one always rendered on a black field).
    //
    // Toggling Pipeline on in the PostFX panel still works and the effects are
    // tuned above; the backdrop just goes with it until the pass is fixed.
    runtime.parameters.set('postfx.enabled', false)
  },
})
