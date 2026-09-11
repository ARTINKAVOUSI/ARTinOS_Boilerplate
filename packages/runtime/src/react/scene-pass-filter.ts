/** Keep capture mutations inside the synchronous PassNode draw, restoring even on failure. */
export function withScenePassFilter<T>(scene: any, exclude: (object: any) => boolean, draw: () => T): T {
  const hidden: any[] = []
  try {
    scene.traverse((object: any) => {
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

export const isTransmissionGlass = (object: any) => object.isMesh &&
  (object.userData?.transmissionGlass === true || (Array.isArray(object.material) ? object.material : [object.material])
    .some((material: any) => material?.isTransmissionGlassMaterial))

export function configureScenePasses(scenePass: any, backdropPass: any, scene: any, cleanPass?: any, clean = false) {
  if (cleanPass) configureScenePasses({ updateBefore() {} }, cleanPass, scene, undefined, true)
  const capture = backdropPass.updateBefore.bind(backdropPass)
  backdropPass.updateBefore = (frame: any) => {
    let scale = 0.1
    let fill: any = null
    let needsBackside = false
    let meshCount = 0
    scene.traverseVisible((object: any) => {
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
      const changed: Array<[any, any]> = []
      try {
        return withScenePassFilter(scene, object => {
          if (!isTransmissionGlass(object)) return false
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          if (!materials.some((m: any) => m.transmissionBackdropConfig?.backside && m.transmissionBacksideMaterial)) return true
          changed.push([object, object.material])
          const replacements = materials.map((m: any) => m.transmissionBacksideMaterial ?? m)
          object.material = Array.isArray(object.material) ? replacements : replacements[0]
          return false
        }, () => capture(frame))
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
  scenePass.updateBefore = (frame: any) => {
    // Same-frame capture must finish before any beauty material samples its texture.
    frame.updateBeforeNode(backdropPass)
    return withScenePassFilter(scene, object => object.userData?.transmissionBackdropOnly === true, () => beauty(frame))
  }
}
