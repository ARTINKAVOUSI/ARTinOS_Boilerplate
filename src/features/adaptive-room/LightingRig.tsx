import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DoubleSide, Vector3, type DirectionalLight, type Group, type HemisphereLight, type Mesh, type MeshBasicMaterial, type OrthographicCamera, type PointLight, type SpotLight } from 'three/webgpu'
import { channelGain, type LightChannelId, type LightParams } from './lighting'
import { clamp, type RoomDims } from './params'

/**
 * The room's studio rig, laid out against the live room dimensions every
 * frame: a shadow-casting key, a fill, rim and top spots, twin softbox spots,
 * an accent point and a ring of up to six coloured points. Intensities and
 * colours glide toward their targets, so a recipe change fades rather than
 * cuts.
 *
 * Positions are room-local (floor y = 0, open front z = 0, rear wall at -z),
 * so mount it inside the room's group.
 */

const RING_MAX = 6
const DEG = Math.PI / 180
const white = new Color(0xffffff)
const scratch = new Color()
const look = new Vector3()
const lookWorld = new Vector3()

/** Move a light colour toward a gel, with saturation and a wash toward white. */
function glide(color: Color, hex: string, saturation: number, wash: number, k: number) {
  scratch.set(hex || '#ffffff')
  const s = clamp(saturation, 0, 2)
  if (s !== 1) {
    const hsl = { h: 0, s: 0, l: 0 }
    scratch.getHSL(hsl)
    scratch.setHSL(hsl.h, clamp(hsl.s * s, 0, 1), hsl.l)
  }
  if (wash > 0.001) scratch.lerp(white, clamp(wash, 0, 1))
  color.lerp(scratch, k)
}

function fade(light: { intensity: number }, target: number, k: number) {
  light.intensity += (target - light.intensity) * k
}

/** Show a helper marker at a light, or hide it. */
function mark(marker: Mesh | null, at: Vector3, scale: number, color: Color, show: boolean) {
  if (!marker) return
  marker.visible = show
  if (!show) return
  marker.position.copy(at)
  marker.scale.setScalar(scale)
  ;(marker.material as MeshBasicMaterial).color.copy(color)
}

export function LightingRig({ light, dims }: { light: LightParams; dims: RefObject<RoomDims> }) {
  const params = useRef(light)
  params.current = light

  const group = useRef<Group>(null)
  const hemi = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const fill = useRef<DirectionalLight>(null)
  const rim = useRef<SpotLight>(null)
  const top = useRef<SpotLight>(null)
  const softL = useRef<SpotLight>(null)
  const softR = useRef<SpotLight>(null)
  const accent = useRef<PointLight>(null)
  const ring = useRef<(PointLight | null)[]>([])
  const ringPhase = useRef(0)
  const shadowFit = useRef({ w: -1, h: -1, d: -1, az: -999, el: -999 })

  const helpKey = useRef<Mesh>(null)
  const helpRim = useRef<Mesh>(null)
  const helpAccent = useRef<Mesh>(null)
  const helpSoftL = useRef<Mesh>(null)
  const helpSoftR = useRef<Mesh>(null)
  const helpRing = useRef<(Mesh | null)[]>([])

  // A light aims at its `target`, which must live in the same space as the
  // light, so the targets join the rig's group rather than float at the origin.
  useLayoutEffect(() => {
    const root = group.current
    if (!root) return
    const aimed = [key, fill, rim, top, softL, softR].flatMap(ref => (ref.current ? [ref.current.target] : []))
    for (const target of aimed) root.add(target)
    return () => {
      for (const target of aimed) root.remove(target)
    }
  }, [])

  useFrame(
    (_, delta) => {
      const d = dims.current
      const par = params.current
      const root = group.current
      const hemiL = hemi.current
      const keyL = key.current
      const fillL = fill.current
      const rimL = rim.current
      const topL = top.current
      const softLL = softL.current
      const softRL = softR.current
      const accentL = accent.current
      if (!d || !root || !hemiL || !keyL || !fillL || !rimL || !topL || !softLL || !softRL || !accentL) return

      const dt = Math.min(delta, 1 / 20)
      const k = 1 - Math.exp(-6 * dt)
      const master = Math.max(0, par.master)
      const gain = (channel: LightChannelId) => master * channelGain(par, channel)
      const sat = par.gelSaturation
      const wash = par.gelWash

      // ---- intensity and colour ------------------------------------------
      fade(keyL, par.keyIntensity * gain('key'), k)
      fade(fillL, par.fillIntensity * gain('fill'), k)
      fade(rimL, par.rimIntensity * gain('rim'), k)
      fade(topL, par.topIntensity * gain('top'), k)
      fade(softLL, par.softboxIntensity * gain('softbox'), k)
      fade(softRL, par.softboxIntensity * gain('softbox'), k)
      fade(accentL, par.accentIntensity * gain('accent'), k)
      fade(hemiL, par.ambient * gain('ambient'), k)

      glide(keyL.color, par.keyColor, sat, wash, k)
      glide(fillL.color, par.fillColor, sat, wash, k)
      glide(rimL.color, par.rimColor, sat, wash, k)
      glide(topL.color, par.topColor, sat * 0.7, wash, k)
      glide(softLL.color, par.softboxColor, sat, wash, k)
      glide(softRL.color, par.softboxColorR || par.softboxColor, sat, wash, k)
      glide(accentL.color, par.accentColor, sat, wash, k)
      hemiL.color.lerp(scratch.set(par.skyColor), k)
      hemiL.groundColor.lerp(scratch.set(par.groundColor), k)

      const soft = clamp((par.keySoftness + par.shadowSoftness) * 0.5, 0, 1)
      keyL.shadow.radius = 1 + soft * 12
      keyL.shadow.bias = -0.00015 - soft * 0.0001
      keyL.shadow.normalBias = 0.02 + soft * 0.02
      rimL.angle = 0.25 + par.rimSpread * 0.55
      rimL.penumbra = 0.4 + par.keySoftness * 0.5

      // ---- layout against the live room ------------------------------------
      const W = Math.max(0.5, d.width)
      const H = Math.max(0.5, d.height)
      const D = Math.max(0.5, d.totalDepth)
      const cy = H * 0.35
      const cz = -D * 0.45

      const kaz = par.keyAzimuth * DEG
      const kel = par.keyElevation * DEG
      const keyR = Math.max(W, D) * 0.55 + 3.5
      keyL.position.set(Math.sin(kaz) * Math.cos(kel) * keyR, cy + Math.sin(kel) * keyR + H * 0.15, cz + Math.cos(kaz) * Math.cos(kel) * keyR + D * 0.5)
      keyL.target.position.set(0, cy * 0.6, cz)

      const faz = par.fillAzimuth * DEG
      const fel = 25 * DEG
      const fillR = Math.max(W, D) * 0.45 + 2.5
      fillL.position.set(Math.sin(faz) * Math.cos(fel) * fillR, cy + Math.sin(fel) * fillR + H * 0.1, cz + Math.cos(faz) * Math.cos(fel) * fillR + D * 0.35)
      fillL.target.position.set(0, H * 0.35, cz)

      // Rim, top and softboxes sit outside the shell; none casts shadows, so
      // they light the interior through the walls.
      const raz = par.rimAzimuth * DEG
      const rimR = D * 0.55 + 1.5
      rimL.position.set(Math.sin(raz) * rimR * 0.6, H * 0.85, cz - Math.abs(Math.cos(raz)) * rimR)
      rimL.target.position.set(0, H * 0.4, cz + 0.3)
      rimL.distance = Math.max(8, D + H + 6)

      topL.position.set(0, H + 0.8, cz)
      topL.target.position.set(0, 0, cz)
      topL.distance = H * 3 + 4
      topL.angle = 0.7
      topL.penumbra = 0.85

      const sbX = W * 0.55 + 0.8
      look.set(0, H * 0.4, cz)
      softLL.position.set(-sbX, H * 0.55, 0.6)
      softRL.position.set(sbX, H * 0.55, 0.6)
      softLL.target.position.copy(look)
      softRL.target.position.copy(look)
      softLL.angle = softRL.angle = 0.55 + par.softboxSize * 0.15
      softLL.penumbra = softRL.penumbra = 0.9
      softLL.distance = softRL.distance = Math.max(10, W + D + 6)

      accentL.position.set(W * 0.35, 0.35, -D * 0.25)
      accentL.distance = Math.max(6, W + 4)

      // ---- coloured ring -----------------------------------------------------
      const ringOn = par.colorRing && par.colorRingIntensity > 0.01
      const ringCount = clamp(Math.round(par.colorRingCount), 2, RING_MAX)
      if (par.colorRingSpeed > 0.01) ringPhase.current += (par.colorRingSpeed * Math.PI * 2 * dt) / 60
      const ringR = Math.min(W, D) * 0.5 * Math.max(0.15, par.colorRingRadius)
      const ringY = H * clamp(par.colorRingHeight, 0.05, 0.95)
      const ringI = ringOn ? par.colorRingIntensity * gain('ring') : 0
      const colors = par.colorRingColors
      for (let i = 0; i < RING_MAX; i++) {
        const point = ring.current[i]
        const marker = helpRing.current[i] ?? null
        if (!point) continue
        const active = ringOn && i < ringCount
        fade(point, active ? ringI : 0, k)
        if (!active && point.intensity < 0.01) {
          point.visible = false
          if (marker) marker.visible = false
          continue
        }
        point.visible = true
        const angle = ringPhase.current + (i / ringCount) * Math.PI * 2
        point.position.set(Math.cos(angle) * ringR, ringY, cz + Math.sin(angle) * ringR * 0.85)
        point.distance = Math.max(5, ringR * 3 + 2)
        glide(point.color, colors[i % Math.max(1, colors.length)], sat, wash, k)
        mark(marker, point.position, 0.1, point.color, par.showHelpers && active)
      }

      // ---- key shadow frustum, refit only when the room or the key moved ---
      const fit = shadowFit.current
      if (Math.abs(fit.w - W) > 0.01 || Math.abs(fit.h - H) > 0.01 || Math.abs(fit.d - D) > 0.01 || Math.abs(fit.az - par.keyAzimuth) > 0.2 || Math.abs(fit.el - par.keyElevation) > 0.2) {
        Object.assign(fit, { w: W, h: H, d: D, az: par.keyAzimuth, el: par.keyElevation })
        const cam = keyL.shadow.camera as OrthographicCamera
        const span = Math.max(W, D) * 0.8 + 2.5
        cam.left = -span
        cam.right = span
        cam.top = span
        cam.bottom = -span
        cam.near = 0.5
        cam.far = keyR * 2.5 + H + D
        cam.updateProjectionMatrix()
      }

      // ---- helpers -----------------------------------------------------------
      const show = par.showHelpers
      mark(helpKey.current, keyL.position, 0.18, keyL.color, show)
      mark(helpRim.current, rimL.position, 0.12, rimL.color, show)
      mark(helpAccent.current, accentL.position, 0.1, accentL.color, show)
      // lookAt takes world coordinates; the rig is offset with the room.
      root.updateWorldMatrix(true, false)
      root.localToWorld(lookWorld.copy(look))
      const panels: [Mesh | null, SpotLight][] = [
        [helpSoftL.current, softLL],
        [helpSoftR.current, softRL],
      ]
      for (const [panel, spot] of panels) {
        if (!panel) continue
        panel.visible = show && par.softboxIntensity > 0.01
        if (!panel.visible) continue
        panel.position.copy(spot.position)
        panel.lookAt(lookWorld)
        const size = 1.5 * par.softboxSize
        panel.scale.set(size * 0.6, size, 1)
        ;(panel.material as MeshBasicMaterial).color.copy(spot.color)
      }
    },
    // After the room (which runs at -2) has applied this frame's dimensions.
    { priority: -3 },
  )

  const marker = (ref: RefObject<Mesh | null> | ((mesh: Mesh | null) => void), segments: [number, number] = [12, 8]) => (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[1, ...segments]} />
      <meshBasicMaterial color="#ffffff" depthTest={false} />
    </mesh>
  )
  const panel = (ref: RefObject<Mesh | null>) => (
    <mesh ref={ref} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={DoubleSide} depthTest={false} />
    </mesh>
  )

  return (
    <group ref={group}>
      <hemisphereLight ref={hemi} args={['#fdf6ea', '#b8b0a4', 0.42]} />
      <directionalLight ref={key} castShadow intensity={2.6} color="#fff5e8" shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.025} />
      <directionalLight ref={fill} intensity={0.55} color="#e7ecf5" />
      <spotLight ref={rim} intensity={0} color="#fff0e0" angle={0.5} penumbra={0.7} distance={20} decay={1.5} />
      <spotLight ref={top} intensity={0} color="#fff8f0" angle={0.7} penumbra={0.85} distance={20} decay={1.4} />
      <spotLight ref={softL} intensity={0} color="#ffffff" angle={0.7} penumbra={0.9} distance={20} decay={1.4} />
      <spotLight ref={softR} intensity={0} color="#ffffff" angle={0.7} penumbra={0.9} distance={20} decay={1.4} />
      <pointLight ref={accent} intensity={0} color="#a8c4ff" distance={10} decay={1.6} />
      {Array.from({ length: RING_MAX }, (_, i) => (
        <group key={i}>
          <pointLight
            ref={(point: PointLight | null) => {
              ring.current[i] = point
            }}
            visible={false}
            intensity={0}
            distance={8}
            decay={1.7}
          />
          {marker(mesh => {
            helpRing.current[i] = mesh
          }, [10, 8])}
        </group>
      ))}
      {marker(helpKey, [16, 12])}
      {marker(helpRim)}
      {marker(helpAccent)}
      {panel(helpSoftL)}
      {panel(helpSoftR)}
    </group>
  )
}
