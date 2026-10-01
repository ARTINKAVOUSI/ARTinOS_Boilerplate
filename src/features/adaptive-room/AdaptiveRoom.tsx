import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DoubleSide, MathUtils, MeshStandardMaterial, Quaternion, Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three/webgpu'
import type { Feature } from '../../app/feature'
import { useSignalCleanup, useSignals } from '../../app/signals'
import { LightingRig } from './LightingRig'
import { COLOR_SCHEMES, DEFAULT_LIGHT, LIGHT_MODES, type LightChannelId, type LightModeId, type LightParams } from './lighting'
import { clamp, fitFrustum, FRONT_PAD, STAGE_KEYS, type RoomParams, type StageDims } from './params'
import { pedestalGeometry, STAGES, type PedestalShape, type StageId } from './stages'
import { getPlasterMaps } from './textures'
import { getTheme, THEMES } from './themes'

/** Plaster colour and roughness at these values follow the theme; anything else overrides it. */
const THEME_COLOR = '#e9e4dc'
const THEME_ROUGHNESS = 0.95
/** One damping rate for every transition, so a resize re-composes the room instead of rebuilding it. */
const LAMBDA = 6.5
/** A level camera looking straight into the room (down -z). */
const LEVEL = new Quaternion()

export interface AdaptiveRoomProps {
  /**
   * The stage's shape. `room`: open-front chamber. `cyclorama`: seamless
   * floor-to-wall sweep. `apse`: curved wall wrapping the subject, open above.
   * `niche`: arched alcove in a wall that fills the frame.
   */
  stage?: StageId
  /** Interior height, world units. Stays put across aspect ratios. */
  height?: number
  /** Interior depth from the open front to the composition plane. */
  depth?: number
  /** Cove radius of every interior edge. */
  radius?: number
  wallThickness?: number
  /** Extra recess behind the rear wall. */
  rearInset?: number
  /** World height of the floor. -1.15 matches the studio's Ground and models. */
  floor?: number
  /**
   * `fit`: the room frames the camera — a level view whose distance and FOV
   * follow the room — and pauses the navigation controls while it does.
   * `free`: the camera is left alone; the room still fits its width to the aspect.
   */
  framing?: 'fit' | 'free'
  /** Vertical FOV the fitted camera settles on, degrees. */
  fov?: number
  /** Safe-area margin as a fraction of the viewport. */
  margin?: number
  /** Multiplier on the fitted camera distance. */
  distance?: number
  /** -0.5 floor-heavy … 0.5 ceiling-heavy, clamped to the frustum margin. */
  verticalBias?: number
  /** Pointer parallax; 0 holds the camera still. */
  parallax?: number
  theme?: string
  /** Plaster colour. At its default it follows the theme. */
  color?: string
  /** Plaster roughness. At its default it follows the theme. */
  roughness?: number
  /** Plaster micro-relief. */
  grain?: number
  /** A plinth under the subject; the stage floor drops by its height, so the subject stays put. */
  pedestal?: PedestalShape
  pedestalHeight?: number
  /** Radius (round) or half-width (square). */
  pedestalSize?: number
  /** The room's own light rig. Off leaves the room to the scene's lights. */
  rig?: boolean
  recipe?: LightModeId
  /** Gel scheme over the recipe; `theme` keeps the theme's light colours. */
  gels?: string
  /** Multiplier over the whole rig, on top of the theme's suggestion. */
  intensity?: number
  /** Channel multipliers over the recipe. */
  keyLight?: number
  fill?: number
  rim?: number
  top?: number
  softbox?: number
  accent?: number
  ambient?: number
  /** Degrees added to the recipe's key azimuth. */
  keyAngle?: number
  /** Degrees added to the recipe's key elevation. */
  keyHeight?: number
  /** Light one channel alone. */
  solo?: 'none' | LightChannelId
  /** Markers at each light. */
  helpers?: boolean
}

/**
 * AdaptiveRoom — a plaster showcase stage that conforms to the camera frustum
 * instead of forcing the camera into a fixed set: an open-front room, a
 * cyclorama, an apse or an arched niche (see `stages.ts`).
 *
 *   viewport -> aspect -> frustum -> visible world size -> stage dimensions
 *
 * Height and depth hold; width follows the aspect, and every change is
 * critically damped. The stage is placed so its composition plane, 52% of the
 * way in, sits at the world origin with the subject's floor at `floor`: the
 * scene's content ends up inside it, framed, on the pedestal when there is
 * one. Live bounds are published as the `room.width`, `room.height`,
 * `room.depth`, `room.floor` and `room.front` signals.
 *
 * Mount inside a WebGPU <Canvas>. While `framing` is `fit` it drives the
 * default perspective camera and disables the default controls; both are
 * restored when it stops. The plaster textures, geometry and material are
 * generated, so it needs no assets.
 */
export function AdaptiveRoom({
  stage = 'room',
  height = 4.5,
  depth = 5,
  radius = 0.8,
  wallThickness = 0.18,
  rearInset = 0.4,
  floor = -1.15,
  framing = 'fit',
  fov = 35,
  margin = 0.06,
  distance = 1,
  verticalBias = 0,
  parallax = 1,
  theme: themeId = 'studio',
  color = THEME_COLOR,
  roughness = THEME_ROUGHNESS,
  grain = 0.35,
  pedestal = 'none',
  pedestalHeight = 0.6,
  pedestalSize = 0.9,
  rig = true,
  recipe = 'studio',
  gels = 'theme',
  intensity = 1,
  keyLight = 1,
  fill = 1,
  rim = 1,
  top = 1,
  softbox = 1,
  accent = 1,
  ambient = 1,
  keyAngle = 0,
  keyHeight = 0,
  solo = 'none',
  helpers = false,
}: AdaptiveRoomProps) {
  const theme = getTheme(themeId)
  const roomHeight = clamp(height, 2, 30)
  const params: RoomParams = {
    height: roomHeight,
    depth: clamp(depth, 2, 50),
    radius: clamp(radius, 0.05, roomHeight * 0.48),
    rearInset: clamp(rearInset, 0, 20),
    wallThickness: clamp(wallThickness, 0.02, 1.5),
    fov: clamp(fov, 8, 110),
    distanceBias: clamp(distance, 0.22, 2),
    margin: clamp(margin, 0.01, 0.2),
    targetBias: clamp(verticalBias, -0.5, 0.5),
  }
  const plaster = {
    color: color === THEME_COLOR ? theme.room : color,
    roughness: roughness === THEME_ROUGHNESS ? theme.roughness : clamp(roughness, 0, 1),
    grain: clamp(grain, 0, 2),
  }

  // Recipe, then gels, then the controls on top.
  const light = useMemo<LightParams>(() => {
    let look: LightParams = { ...DEFAULT_LIGHT, keyColor: theme.key, fillColor: theme.fill, skyColor: theme.hemiSky, groundColor: theme.hemiGround, ...LIGHT_MODES[recipe] }
    if (gels !== 'theme') look = { ...look, ...COLOR_SCHEMES[gels] }
    return {
      ...look,
      master: intensity * theme.lightIntensity,
      keyIntensity: look.keyIntensity * keyLight,
      fillIntensity: look.fillIntensity * fill,
      rimIntensity: look.rimIntensity * rim,
      topIntensity: look.topIntensity * top,
      softboxIntensity: look.softboxIntensity * softbox,
      accentIntensity: look.accentIntensity * accent,
      ambient: look.ambient * ambient,
      keyAzimuth: look.keyAzimuth + keyAngle,
      keyElevation: clamp(look.keyElevation + keyHeight, 2, 89),
      solo: solo === 'none' ? null : solo,
      showHelpers: helpers,
    }
  }, [theme, recipe, gels, intensity, keyLight, fill, rim, top, softbox, accent, ambient, keyAngle, keyHeight, solo, helpers])

  const camera = useThree(state => state.camera)
  const controls = useThree(state => state.controls) as { enabled?: boolean; update?: () => void } | null
  const fitting = framing === 'fit' && (camera as PerspectiveCamera).isPerspectiveCamera === true

  const def = STAGES[stage] ?? STAGES.room
  const plinth = pedestal === 'round' || pedestal === 'square' ? pedestal : 'none'

  // The frame loop reads the latest props from here, without re-subscribing.
  const live = useRef({ def, params, plaster, floor, parallax, plinth: { height: 0, size: 1 } })
  live.current = {
    def,
    params,
    plaster,
    floor,
    parallax: clamp(parallax, 0, 2),
    plinth: { height: plinth === 'none' ? 0 : clamp(pedestalHeight, 0.05, 3), size: clamp(pedestalSize, 0.2, 4) },
  }

  // ---- shell: damped dimensions, one geometry per stage rewritten in place --
  const dims = useRef<StageDims>({
    width: params.height * 1.6,
    height: params.height,
    depth: params.depth,
    totalDepth: params.depth + params.rearInset,
    radius: params.radius,
    wallThickness: params.wallThickness,
    front: 0,
    wallHeight: 0,
    outerWidth: 0,
    archWidth: 0,
    archHeight: 0,
  })
  const applied = useRef<StageDims | null>(null)
  const geometry = useMemo(() => def.create(dims.current), [def])
  // A new stage starts at its own size instead of growing out of the last one's.
  useLayoutEffect(() => {
    applied.current = null
    return () => geometry.dispose()
  }, [geometry])

  // The pedestal is built at unit size and scaled, so its controls glide without rebuilds.
  const pedestalShape = useMemo(() => pedestalGeometry(plinth), [plinth])
  useEffect(() => () => pedestalShape?.dispose(), [pedestalShape])
  const pedestalMesh = useRef<Mesh>(null)
  const raised = useRef({ height: 0, size: clamp(pedestalSize, 0.2, 4) })

  const maps = useMemo(() => getPlasterMaps(), [])
  // Built once and eased every frame, so a theme change fades the plaster.
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: plaster.color,
        roughness: plaster.roughness,
        metalness: 0.02,
        bumpMap: maps.bumpMap,
        bumpScale: plaster.grain,
        roughnessMap: maps.roughnessMap,
        side: DoubleSide,
      }),
    [maps],
  )
  useEffect(
    () => () => {
      material.dispose()
      maps.bumpMap.dispose()
      maps.roughnessMap.dispose()
    },
    [material, maps],
  )

  // ---- camera: borrowed while fitting, handed back as it was ---------------
  // The frame loop drives only a camera saved here, never one that became the
  // default a frame before this effect caught up with it.
  const borrowed = useRef<PerspectiveCamera | null>(null)
  useLayoutEffect(() => {
    if (!fitting) return
    const cam = camera as PerspectiveCamera
    const saved = { position: cam.position.clone(), quaternion: cam.quaternion.clone(), fov: cam.fov, near: cam.near, far: cam.far }
    const paused = controls?.enabled ? controls : null
    if (paused) paused.enabled = false
    borrowed.current = cam
    return () => {
      borrowed.current = null
      cam.position.copy(saved.position)
      cam.quaternion.copy(saved.quaternion)
      cam.fov = saved.fov
      cam.near = saved.near
      cam.far = saved.far
      cam.updateProjectionMatrix()
      if (paused) {
        paused.enabled = true
        paused.update?.()
      }
    }
  }, [fitting, camera, controls])

  const group = useRef<Group>(null)
  const bus = useSignals()
  useSignalCleanup('room')
  const tint = useMemo(() => new Color(), [])
  const aim = useMemo(() => new Vector3(), [])

  useFrame(
    (state, delta) => {
      const { def: shape, params: par, plaster: surface, floor: subjectFloor, parallax: sway, plinth } = live.current
      const dt = Math.min(delta, 1 / 20)
      const damp = (from: number, to: number) => MathUtils.damp(from, to, LAMBDA, dt)

      // 1. frustum fit from the live viewport, and what this stage needs from it
      const fit = fitFrustum(par, state.size.width / Math.max(1, state.size.height))
      const target = shape.dims(par, fit)

      // 2. damp the stage toward it; a stage that has just appeared starts at its size
      const d = dims.current
      const a = applied.current
      for (const key of STAGE_KEYS) d[key] = a ? damp(d[key], target[key]) : target[key]

      // 3. rewrite the vertex buffers only when something actually moved
      let moved = a ? 0 : Infinity
      if (a) for (const key of STAGE_KEYS) moved += Math.abs(a[key] - d[key])
      if (moved > 0.0012) {
        geometry.update(d)
        applied.current = { ...d }
      }

      // 4. the pedestal rises out of the floor; the stage drops so the subject stays put
      const raise = raised.current
      raise.height = damp(raise.height, plinth.height)
      raise.size = damp(raise.size, plinth.size)
      const floorY = subjectFloor - raise.height
      const front = d.depth * 0.52
      pedestalMesh.current?.scale.set(raise.size, Math.max(0.001, raise.height), raise.size)
      pedestalMesh.current?.position.set(0, 0, -front)

      // 5. place the composition plane on the world origin, publish the bounds
      group.current?.position.set(0, floorY, front)
      bus.set('room.width', d.width)
      bus.set('room.height', d.height)
      bus.set('room.depth', d.totalDepth)
      bus.set('room.floor', floorY)
      bus.set('room.front', front)

      // 6. restrained camera rig: level view, damped distance and FOV, a little
      //    parallax that stays inside the safe margins
      const cam = borrowed.current
      if (cam) {
        const far = Math.max(60, fit.dist + d.totalDepth + 20)
        if (cam.fov !== par.fov || Math.abs(cam.far - far) > 0.5 || cam.near !== 0.1) {
          const next = damp(cam.fov, par.fov)
          cam.fov = Math.abs(next - par.fov) < 0.01 ? par.fov : next
          cam.near = 0.1
          cam.far = far
          cam.updateProjectionMatrix()
        }
        const marginY = Math.max(0, (d.height - fit.visH) / 2)
        // Vertical bias, clamped to the margin so the frustum never leaves the opening.
        const lift = par.targetBias * 2 * Math.max(0, marginY - 0.02)
        const swayX = Math.min(0.14, FRONT_PAD * 0.22) * sway
        const swayY = Math.min(0.1, Math.max(0, marginY - Math.abs(lift)) * 0.35) * sway
        aim.set(state.pointer.x * swayX, floorY + d.height / 2 + lift + state.pointer.y * swayY, front + fit.dist)
        const k = 1 - Math.exp(-LAMBDA * dt)
        cam.position.lerp(aim, k)
        cam.quaternion.slerp(LEVEL, k)
      }

      // 7. plaster eases toward the theme or the override
      const k = 1 - Math.exp(-6 * dt)
      material.roughness += (surface.roughness - material.roughness) * k
      material.bumpScale += (surface.grain - material.bumpScale) * k
      material.color.lerp(tint.set(surface.color), k)
    },
    // After the navigation controls (-1), before the light rig (-3).
    { priority: -2 },
  )

  return (
    <group ref={group} name="AdaptiveRoom">
      <mesh name="AdaptiveRoomShell" geometry={geometry} material={material} receiveShadow />
      {pedestalShape && <mesh ref={pedestalMesh} name="AdaptiveRoomPedestal" geometry={pedestalShape} material={material} castShadow receiveShadow />}
      {rig && <LightingRig light={light} dims={dims} />}
    </group>
  )
}

export default AdaptiveRoom

export const feature: Feature = {
  id: 'scene.adaptive-room',
  label: 'Adaptive Stage',
  kind: 'scene',
  group: 'Ground',
  order: 41,
  // The default stage: the scene's content sits inside it, framed.
  enabled: true,
  description: 'Plaster showcase stage fitted to the camera — open room, cyclorama, apse or arched niche, with an optional pedestal. Width follows the aspect; height and depth hold. Has its own light rig.',
  component: AdaptiveRoom,
  controls: {
    stage: {
      type: 'select',
      value: 'room',
      options: Object.keys(STAGES),
      group: 'Stage',
      description: 'room: open-front chamber · cyclorama: seamless floor-to-wall sweep · apse: curved wall wrapping the subject · niche: arched alcove in a wall',
    },
    height: { type: 'number', value: 4.5, min: 2, max: 30, step: 0.05, group: 'Shape', description: 'The framed height; the niche arch is 80% of it.' },
    depth: { type: 'number', value: 5, min: 2, max: 50, step: 0.05, group: 'Shape' },
    radius: { type: 'number', value: 0.8, min: 0.05, max: 4.5, step: 0.01, label: 'Cove radius', group: 'Shape', description: "The room's corners; the floor cove of the cyclorama and apse." },
    floor: { type: 'number', value: -1.15, min: -5, max: 5, step: 0.01, label: 'Floor height', group: 'Shape', description: 'Where the subject stands: the floor, or the top of the pedestal.' },
    wallThickness: { type: 'number', value: 0.18, min: 0.02, max: 1.5, step: 0.01, label: 'Wall', group: 'Shape', advanced: true, description: "The room's wall thickness." },
    rearInset: { type: 'number', value: 0.4, min: 0, max: 20, step: 0.05, label: 'Rear inset', group: 'Shape', advanced: true },
    framing: { type: 'select', value: 'fit', options: ['fit', 'free'], label: 'Camera', group: 'Framing', description: 'fit: the room frames the camera and pauses Navigation. free: the camera stays yours.' },
    fov: { type: 'number', value: 35, min: 8, max: 110, step: 1, unit: '°', label: 'FOV', group: 'Framing' },
    distance: { type: 'number', value: 1, min: 0.22, max: 2, step: 0.01, group: 'Framing' },
    margin: { type: 'number', value: 0.06, min: 0.01, max: 0.2, step: 0.005, label: 'Safe margin', group: 'Framing' },
    parallax: { type: 'number', value: 1, min: 0, max: 2, step: 0.01, group: 'Framing' },
    verticalBias: { type: 'number', value: 0, min: -0.5, max: 0.5, step: 0.01, label: 'Vertical bias', group: 'Framing', advanced: true },
    theme: { type: 'select', value: 'studio', options: THEMES.map(theme => theme.id), group: 'Plaster' },
    color: { type: 'color', value: THEME_COLOR, group: 'Plaster', description: 'Reset to follow the theme.' },
    roughness: { type: 'number', value: THEME_ROUGHNESS, min: 0, max: 1, step: 0.01, group: 'Plaster', description: 'Reset to follow the theme.' },
    grain: { type: 'number', value: 0.35, min: 0, max: 2, step: 0.01, group: 'Plaster' },
    pedestal: { type: 'select', value: 'none', options: ['none', 'round', 'square'], label: 'Shape', group: 'Pedestal', description: 'A plinth under the subject; the stage floor drops so the subject stays where it is.' },
    pedestalHeight: { type: 'number', value: 0.6, min: 0.05, max: 3, step: 0.01, label: 'Height', group: 'Pedestal' },
    pedestalSize: { type: 'number', value: 0.9, min: 0.2, max: 4, step: 0.01, label: 'Size', group: 'Pedestal', description: 'Radius, or half the width of a square plinth.' },
    rig: { type: 'boolean', value: true, label: 'Light rig', group: 'Lighting', description: "The stage's own studio rig. Off leaves the stage to the scene's lights." },
    recipe: { type: 'select', value: 'studio', options: Object.keys(LIGHT_MODES), group: 'Lighting' },
    gels: { type: 'select', value: 'theme', options: ['theme', ...Object.keys(COLOR_SCHEMES)], group: 'Lighting' },
    intensity: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting' },
    keyLight: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, label: 'Key', group: 'Lighting' },
    fill: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting' },
    ambient: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting' },
    keyAngle: { type: 'number', value: 0, min: -180, max: 180, step: 1, unit: '°', label: 'Key angle', group: 'Lighting' },
    keyHeight: { type: 'number', value: 0, min: -60, max: 45, step: 1, unit: '°', label: 'Key height', group: 'Lighting', advanced: true },
    rim: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting', advanced: true },
    top: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting', advanced: true },
    softbox: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting', advanced: true },
    accent: { type: 'number', value: 1, min: 0, max: 4, step: 0.01, group: 'Lighting', advanced: true },
    solo: { type: 'select', value: 'none', options: ['none', 'key', 'fill', 'rim', 'top', 'softbox', 'accent', 'ring', 'ambient'], group: 'Lighting', advanced: true },
    helpers: { type: 'boolean', value: false, label: 'Light markers', group: 'Lighting', advanced: true },
  },
}
