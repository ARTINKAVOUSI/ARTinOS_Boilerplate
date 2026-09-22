/**
 * The glass capture passes, ported from v1's scene-pass-filter.
 *
 * Pass contract, run inside the scene pass's own update so it is synchronous
 * with the frame:
 *   1. Glass / Clean    hides glass and captures the scene behind it, when any
 *                       glass wants a backside.
 *   2. Glass / Backdrop draws the glass back faces (their backside materials,
 *                       sampling Clean) or, with no backside, the scene without
 *                       glass.
 *   3. Scene / Beauty   renders front faces sampling Backdrop; objects tagged
 *                       `transmissionBackdropOnly` are left out.
 *
 * Every visibility, material, layer and background change is restored even if
 * a capture throws. With no glass in view the backdrop pass returns after one
 * traversal.
 */

import { LinearMipmapLinearFilter } from 'three/webgpu'
import { pass } from 'three/tsl'
import type { PostFXPassProvider } from '../../postfx/PostFX'

// Three's pass nodes are loosely typed; this file drives them opaquely.
type AnyNode = any

/** The captures glass materials refract: the backdrop, and the clean scene their back faces sample. */
export interface GlassCapture {
  backdrop: AnyNode
  clean: AnyNode
}

/**
 * The glass passes, registered with `<PostFX>` through `usePostFXPass('glass', glassPasses)`.
 * Mipmapped so rough glass can sample a blurrier level; one scene traversal a
 * frame when no glass is in view.
 */
export const glassPasses: PostFXPassProvider<GlassCapture> = {
  create({ scenePass, scene, camera }) {
    const backdropPass: AnyNode = pass(scene, camera)
    backdropPass.name = 'Glass / Backdrop'
    const cleanPass: AnyNode = pass(scene, camera)
    cleanPass.name = 'Glass / Clean'
    for (const capture of [backdropPass, cleanPass]) {
      const target = capture.renderTarget.texture
      target.generateMipmaps = true
      target.minFilter = LinearMipmapLinearFilter
    }
    configureScenePasses(scenePass, backdropPass, scene, cleanPass)
    // v1's glass monitoring, four times a second.
    let elapsed = 0
    return {
      value: { backdrop: backdropPass.getTextureNode(), clean: cleanPass.getTextureNode() },
      update(delta) {
        elapsed += delta
        if (elapsed < 0.25) return
        elapsed = 0
        glassMonitor.sample(scene, backdropPass, cleanPass)
      },
      dispose() {
        backdropPass.dispose()
        cleanPass.dispose()
        glassMonitor.reset()
      },
    }
  },
}

/** Keep capture mutations inside the synchronous PassNode draw, restoring even on failure. */
export function withScenePassFilter<T>(scene: AnyNode, exclude: (object: AnyNode) => boolean, draw: () => T): T {
  const hidden: AnyNode[] = []
  try {
    scene.traverse((object: AnyNode) => {
      if (object.visible && exclude(object)) {
        hidden.push(object)
        object.visible = false
      }
    })
    return draw()
  } finally {
    for (const object of hidden) object.visible = true
  }
}

export const isTransmissionGlass = (object: AnyNode) =>
  object.isMesh &&
  (object.userData?.transmissionGlass === true ||
    (Array.isArray(object.material) ? object.material : [object.material]).some((material: AnyNode) => material?.isTransmissionGlassMaterial))

export function configureScenePasses(scenePass: AnyNode, backdropPass: AnyNode, scene: AnyNode, cleanPass?: AnyNode, clean = false) {
  if (cleanPass) configureScenePasses({ updateBefore() {} }, cleanPass, scene, undefined, true)
  const capture = backdropPass.updateBefore.bind(backdropPass)
  backdropPass.updateBefore = (frame: AnyNode) => {
    let scale = 0.1
    let fill: AnyNode = null
    let needsBackside = false
    let meshCount = 0
    scene.traverseVisible((object: AnyNode) => {
      if (!isTransmissionGlass(object)) return
      meshCount++
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const config = material.transmissionBackdropConfig
        if (!config) continue
        needsBackside ||= !!config.backside
        if (clean && !config.backside) continue
        scale = Math.max(scale, (clean && config.backside ? config.backsideResolutionScale : config.backdropResolutionScale) ?? 1)
        fill ??= config.background
      }
    })
    backdropPass.captureActive = meshCount > 0
    if (!meshCount) return
    backdropPass.setResolutionScale(Math.min(1, Math.max(0.1, scale)))
    const background = scene.background
    // A project background wins; the material fill only supplies otherwise empty pixels.
    if (background === null && !scene.backgroundNode && fill) scene.background = fill
    const camera = backdropPass.camera
    const layerMask = camera?.layers.mask
    camera?.layers.enable(1)
    const started = performance.now()
    try {
      if (!cleanPass || !needsBackside) return withScenePassFilter(scene, isTransmissionGlass, () => capture(frame))
      frame.updateBeforeNode(cleanPass)
      const changed: Array<[AnyNode, AnyNode]> = []
      try {
        return withScenePassFilter(
          scene,
          object => {
            if (!isTransmissionGlass(object)) return false
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            if (!materials.some((m: AnyNode) => m.transmissionBackdropConfig?.backside && m.transmissionBacksideMaterial)) return true
            changed.push([object, object.material])
            const replacements = materials.map((m: AnyNode) => m.transmissionBacksideMaterial ?? m)
            object.material = Array.isArray(object.material) ? replacements : replacements[0]
            return false
          },
          () => capture(frame),
        )
      } finally {
        for (const [object, material] of changed) object.material = material
      }
    } finally {
      if (camera) camera.layers.mask = layerMask
      backdropPass.captureCpuMs = performance.now() - started
      scene.background = background
    }
  }
  const beauty = scenePass.updateBefore.bind(scenePass)
  scenePass.updateBefore = (frame: AnyNode) => {
    // Same-frame capture must finish before any beauty material samples its texture.
    frame.updateBeforeNode(backdropPass)
    return withScenePassFilter(scene, object => object.userData?.transmissionBackdropOnly === true, () => beauty(frame))
  }
}

/** What v1 reported about glass, sampled by the glass passes four times a second. */
export interface GlassMonitor {
  meshes: number
  /** Largest refraction tap count among active glass materials. */
  taps: number
  mode: 'Spectral' | 'RGB' | 'inactive'
  backdropResolution: string
  cleanResolution: string
  /** CPU time spent submitting the captures — not GPU duration. */
  captureCpuMs: number
}

const idle: GlassMonitor = { meshes: 0, taps: 0, mode: 'inactive', backdropResolution: 'inactive', cleanResolution: 'bypassed', captureCpuMs: 0 }
let monitor = idle
const monitorListeners = new Set<() => void>()

export const glassMonitor = {
  get: () => monitor,
  reset() {
    monitor = idle
    monitorListeners.forEach(listener => listener())
  },
  subscribe(listener: () => void) {
    monitorListeners.add(listener)
    return () => monitorListeners.delete(listener)
  },
  /** Sample the scene and the capture passes, as v1's pipeline did. */
  sample(scene: AnyNode, backdropPass: AnyNode, cleanPass: AnyNode) {
    let meshes = 0
    let taps = 0
    let backs = false
    let spectral = false
    scene.traverseVisible((object: AnyNode) => {
      if (!isTransmissionGlass(object)) return
      meshes++
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material.isTransmissionGlassMaterial) continue
        taps = Math.max(taps, material.transmissionSampleTaps ?? 0)
        spectral ||= !!material.transmissionSpectral
        backs ||= !!material.transmissionBackdropConfig?.backside
      }
    })
    const resolution = (capture: AnyNode) => `${capture.renderTarget.width}×${capture.renderTarget.height}`
    monitor = {
      meshes,
      taps,
      mode: meshes ? (spectral ? 'Spectral' : 'RGB') : 'inactive',
      backdropResolution: meshes ? resolution(backdropPass) : 'inactive',
      cleanResolution: meshes && backs ? resolution(cleanPass) : 'bypassed',
      captureCpuMs: meshes ? (backdropPass.captureCpuMs ?? 0) : 0,
    }
    monitorListeners.forEach(listener => listener())
  },
}
