import { Suspense, useCallback, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { defineArtinosProject } from '@artinos/r3f'
import { GlassRings, glassParameterList, useGlassParameters } from '@artinos/modules/materials'
import { BackdropImage } from '@artinos/modules/scene'
import { useResolvedParameter, useResolvedParameterRef, type ParameterDefinition } from '@artinos/runtime'
import type { Group } from 'three'

const defs = {
  name: { id: 'ui-platform.object.name', label: 'Object Name', type: 'string', defaultValue: 'Glass Rings', group: 'Identity' },
  visible: { id: 'ui-platform.object.visible', label: 'Visible', type: 'boolean', defaultValue: true, group: 'Identity' },
  position: { id: 'ui-platform.transform.position', label: 'Position', type: 'vec3', defaultValue: [0, .15, 0], min: -4, max: 4, step: .01, group: 'Transform' },
  quaternion: { id: 'ui-platform.transform.quaternion', label: 'Quaternion', type: 'vec4', defaultValue: [0, 0, 0, 1], min: -1, max: 1, step: .001, group: 'Transform', presentation: { preferred: 'quaternion-control' } },
  scale: { id: 'ui-platform.transform.scale', label: 'Scale', type: 'number', defaultValue: 1, min: .1, max: 3, step: .01, group: 'Transform' },
  spin: { id: 'ui-platform.motion.spin', label: 'Band Orbit', type: 'number', defaultValue: 1, min: 0, max: 3, step: .01, group: 'Motion', modulatable: true, presentation: { preferred: 'dial' } },
  orbit: { id: 'ui-platform.motion.orbit', label: 'Drift', type: 'vec2', defaultValue: [.06, 0], min: -1, max: 1, step: .01, group: 'Motion', presentation: { preferred: 'xy-pad' }, modulatable: true },
  pulse: { id: 'ui-platform.motion.pulse', label: 'Input Pulse', type: 'number', defaultValue: 0, min: 0, max: 1, step: .001, group: 'Motion', modulatable: true, presentation: { preferred: 'meter' } },
  // The glass refracts whatever the backdrop capture renders, and the capture paints its own
  // fill behind the scene — the CSS artwork behind a transparent canvas is not visible to it.
  // This is that fill, so it should sit close to the workspace backdrop's midtone.
  backdrop: { id: 'ui-platform.glass.backdrop', label: 'Backdrop Fill', type: 'color', defaultValue: '#c8b394', group: 'Glass Quality', presentation: { preferred: 'color-control' } },
  backdropImage: { id: 'ui-platform.backdrop.image', label: 'Backdrop Image', type: 'string', defaultValue: '/backgrounds/persian-garden.png', group: 'Backdrop', description: 'Blank to render nothing behind the subject' },
  backdropTint: { id: 'ui-platform.backdrop.tint', label: 'Backdrop Tint', type: 'color', defaultValue: '#ffffff', group: 'Backdrop', presentation: { preferred: 'color-control' } },
  metalColor: { id: 'ui-platform.metal.color', label: 'Band Color', type: 'color', defaultValue: '#B59D85', group: 'Band', presentation: { preferred: 'color-control' } },
  metalRoughness: { id: 'ui-platform.metal.roughness', label: 'Band Roughness', type: 'number', defaultValue: .29, min: 0, max: 1, step: .01, group: 'Band' },
  asset: { id: 'ui-platform.environment.asset', label: 'Environment Asset', type: 'asset', defaultValue: { id: 'none', kind: 'asset', label: 'Studio default' }, group: 'Environment' },
} satisfies Record<string, ParameterDefinition>

function Rings({ backdropMap }: { backdropMap?: any }) {
  const group = useRef<Group>(null)
  const elapsed = useRef(0)

  const visible = useResolvedParameter(defs.visible)
  const name = String(useResolvedParameter(defs.name))
  const position = useResolvedParameter(defs.position) as number[]
  const quaternion = useResolvedParameter(defs.quaternion) as number[]
  const scale = Number(useResolvedParameter(defs.scale))
  const spin = Number(useResolvedParameter(defs.spin))
  const backdrop = String(useResolvedParameter(defs.backdrop))
  const metalColor = String(useResolvedParameter(defs.metalColor))
  const metalRoughness = Number(useResolvedParameter(defs.metalRoughness))

  const orbit = useResolvedParameterRef(defs.orbit.id, [.06, 0])
  const pulse = useResolvedParameterRef(defs.pulse.id, 0)

  const glass = useGlassParameters()

  useFrame((_state, delta) => {
    if (!group.current) return
    elapsed.current += delta
    const drift = orbit.current as number[]
    group.current.rotation.y = elapsed.current * Number(drift[0] ?? 0)
    group.current.rotation.x = elapsed.current * Number(drift[1] ?? 0)
  })

  if (!visible) return null

  return (
    <group
      ref={group}
      name={name}
      position={position as [number, number, number]}
      quaternion={quaternion as [number, number, number, number]}
      scale={scale}
    >
      <GlassRings
        spin={spin + Number(pulse.current) * 2}
        backdropMap={backdropMap}
        glass={{ ...glass, background: backdrop }}
        metalColor={metalColor}
        metalRoughness={metalRoughness}
      />
    </group>
  )
}

// The garden is a scene object, not a CSS layer. Transmissive materials refract what the renderer
// can see, and a picture behind a transparent canvas is invisible to it — which is exactly why the
// glass read as a black silhouette. No ground plane: it read as a black dome over the backdrop.
function Content() {
  const backdropUrl = String(useResolvedParameter(defs.backdropImage))
  const backdropTint = String(useResolvedParameter(defs.backdropTint))
  // The glass refracts the very texture the backdrop plane is showing, so what you see through it
  // is exactly what is behind it.
  const [backdropMap, setBackdropMap] = useState<any>(null)
  const handleTexture = useCallback((texture: any) => setBackdropMap(texture), [])
  return (
    <Suspense fallback={null}>
      {backdropUrl ? <BackdropImage url={backdropUrl} tint={backdropTint} onTexture={handleTexture} /> : null}
      <Rings backdropMap={backdropMap} />
    </Suspense>
  )
}

const glassDefaults = Object.fromEntries(glassParameterList.map(def => [def.id, def.defaultValue]))

export default defineArtinosProject({
  id: 'ui-platform', name: 'ARTINOS UI Platform', version: '1.0.0', description: 'Flagship semantic UI, input, automation, scene and PostFX integration', default: true, shell: 'studio',
  renderer: { backend: 'auto', dpr: [.75, 2], shadows: true, postfx: true, antialias: false, alpha: true, powerPreference: 'high-performance', threeInspector: true },
  Content,
  parameters: [...Object.values(defs), ...glassParameterList],
  bindings: [{ id: 'ui-platform.audio-pulse', source: 'audio.bass', target: defs.pulse.id, mode: 'replace', input: [0, .67], output: [0, 1], clamp: true, smooth: .28 }],
  presets: [
    { id: 'ui-platform:clear', label: 'Clear Glass', group: 'ui-platform', values: { ...glassDefaults } },
    { id: 'ui-platform:prism', label: 'Prism', group: 'ui-platform', values: { ...glassDefaults, 'glass.ior': 1.62, 'glass.dispersion': 16, 'glass.spectralDispersion': true, 'glass.samples': 10, 'glass.roughness': 0 } },
    { id: 'ui-platform:frosted', label: 'Frosted', group: 'ui-platform', values: { ...glassDefaults, 'glass.roughness': .34, 'glass.anisotropicBlur': .5, 'glass.dispersion': 2, 'glass.thickness': 1.4 } },
  ],
  setup: ({ runtime }) => {
    // Bloom at strength 1 / threshold .8 clips every lit surface into a white blob. Eased so the
    // glass still blooms without washing the frame out.
    runtime.setParameter('postfx.bloom.strength', .38, 'Bloom over backdrop', { source: 'ui' })
    runtime.setParameter('postfx.bloom.threshold', .95, 'Bloom over backdrop', { source: 'ui' })
    runtime.setParameter('scene.background.mode', 'transparent', 'Workspace backdrop', { source: 'ui' })
    runtime.setParameter('render.clearAlpha', 0, 'Workspace backdrop', { source: 'ui' })
    const applyEnvironmentAsset = () => {
      const asset = runtime.parameters.getBase<any>(defs.asset.id)
      if (asset?.uri && !/\.(hdr|exr)$/i.test(asset.label ?? '') && !/^data:application\/(hdr|exr)/.test(asset.uri)) {
        runtime.logger.warn('Choose an HDR or EXR file for the glass environment.', { source: 'ui-platform' })
        return
      }
      runtime.setParameter('scene.environment.hdr', asset?.uri ?? '', 'Set environment asset', { source: 'ui' })
      runtime.setParameter('scene.environment', asset?.uri ? 'hdr' : 'studio', 'Select environment', { source: 'ui' })
    }
    const removeAsset = runtime.parameters.subscribeBase(defs.asset.id, applyEnvironmentAsset)
    const removeManifest = runtime.resources.set('ui-platform.connections', { scene: Object.keys(defs), input: ['audio.bass'], glass: glassParameterList.map(entry => entry.id), postfx: ['postfx.bloom.enabled', 'postfx.bloom.strength'] }, { kind: 'ui-platform-manifest', owner: 'ui-platform' })
    return [removeAsset, removeManifest]
  },
})
