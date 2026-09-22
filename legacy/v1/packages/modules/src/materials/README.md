# ARTINOS glass

The port combines the local `webgpu-glass-drei-main` reference's reusable props and grazing-angle thickness with `webgpu-mesh-transmission-material-main`'s spectral sampling and full physical surface controls. The volume ray, roughness mip sampling, Vogel-disk sampling, Beer–Lambert absorption and DFG Fresnel calculations follow their `transmissionNodes` implementations.

ARTINOS uses its shared Three r185 RenderPipeline for capture scheduling. It does not mount another renderer or a competing frame loop.

```tsx
import { GlassMaterial, GlassMesh, GlassRings } from '@artinos/modules/materials'

// Any existing mesh:
<mesh geometry={geometry}>
  <GlassMaterial ior={1.5} thickness={0.6} dispersion={6} samples={6} backside />
</mesh>

// Reusable mesh wrapper (also accepts geometry, transform, events and a mesh ref):
<GlassMesh position={[0, 1, 0]} glass={{ spectralDispersion: true, samples: 10 }}>
  <sphereGeometry args={[1, 48, 32]} />
</GlassMesh>

// Bundled torus and orbiting metal band:
<GlassRings glass={{ roughness: 0.05, backside: true }} />
```

Use these inside an ARTINOS Canvas/runtime. Keep `renderer.postfx: true` so captures are available. The **Effects pipeline** switch can be off: it bypasses artistic effects while preserving glass capture. Without the shared pipeline, the material uses an optional `backdropMap` or a viewport fallback; the two-stage backside feature requires the pipeline.

## Inspector integration

Register `glassParameterList` on the project and pass `useGlassParameters()` to a material or component. All controls live in the existing Inspector, including **Advanced** surface settings (reflectivity/specular color, metalness, sheen, anisotropy, clearcoat roughness and iridescence film thickness). The registry also provides the spectral switch and performance controls.

The same Inspector embeds **Glass optics & monitoring**: shader-matched RGB IOR curves, critical angle, normal-incidence Fresnel, capture dimensions, tap count, CPU submission time and the existing Three renderer monitor. The latter provides GPU timestamp measurements, frame timing, memory, timeline, resource viewer and console. CPU submission time is not GPU duration. No second panel or renderer instance is created.

The registered `glass.*` controls intentionally describe one shared look. For independent objects, pass separate `glass` props; all instances share scene captures sized to the highest requested resolution. Tap count reports the largest active sample set, not a frame-wide GPU operation count.

## Pass contract

1. **Glass / Clean** hides glass and captures scene geometry/background when a backside is requested.
2. **Glass / Backdrop** optionally draws separate back-face materials sampling Clean. Their thickness uses `backsideThickness`.
3. **Scene / Beauty** renders front materials sampling Backdrop; objects tagged `transmissionBackdropOnly` are excluded.
4. PostFX consumes Beauty. Bloom is added to the input; final output preserves scene alpha. MRT attachment changes allocate a fresh scene pass.

Captures use distinct half-float mipmapped targets. The current frame is sampled, without feedback into the active attachment or a previous-frame delay. Scene visibility, material assignments, camera layers and background are restored after capture. Background color/texture already owned by the scene takes precedence over the material's fallback fill.

`backdropResolutionScale` controls the final capture. With backside enabled, `backsideResolutionScale` controls Clean. Turning backside off skips Clean. Closed meshes are recommended for volume refraction; this remains screen-space refraction and cannot reveal geometry outside the captured camera view.

## Source references

- `G:/CODE2026/.PROJECTS/ARTINOS/REF/webgpu-glass-drei-main/src/core/`
- `G:/CODE2026/.PROJECTS/ARTINOS/REF/webgpu-mesh-transmission-material-main/src/glass/`
- The latter's `src/glass-panel/` supplies the advanced-panel and optical-chart reference; `src/dev/inspectorSettings.js` supplies the native-inspector integration reference.

The imported demos' imperative capture manager and global settings store are replaced with ARTINOS pass resources and parameter subscriptions. The chart uses the shader's real IOR spread rather than the demo chart's exaggerated spread.

## Reference audit (2026-09-11)

| Reference behavior | ARTINOS implementation |
| --- | --- |
| Prop-driven material and forwarded ref (Drei demo) | `GlassMaterial`, plus `GlassMesh` and `GlassRings`; independent uniforms per material |
| RGB dispersion, volume projection, model scale, Vogel jitter, frost, time-varying noise | `transmission-nodes.ts`; includes the Drei demo's grazing thickness boost |
| Spectral lobes (mesh-transmission demo) | Same stratified lobe integration; minimum three samples prevents missing color channels at low settings |
| Beer–Lambert attenuation and DFG Fresnel | Same equations, including metalness blending; guards zero distance and black attenuation color |
| Clean → back faces → front faces | Shared RenderPipeline passes with separate backside materials; restores state on failed captures |
| Capture resolution and mip filtering | Independent clean/final scales; mip footprint uses actual texture dimensions |
| Physical surface settings | Color, metalness, roughness, specular intensity/color, clearcoat, sheen, anisotropy, iridescence and film range |
| Advanced panel | Existing Inspector parameter groups and Advanced switch; no standalone demo UI |
| Refraction chart | Real shader IOR range, front/back thickness readings, thickness bar, entry/exit directions and critical-angle endpoints |
| Renderer monitoring | Existing Three Inspector embedded in Inspector: Viewer, Performance, Memory, Timeline, Console, Settings |
| Background and environment | Scene-visible photograph for capture; HDR/EXR file import drives environment lighting |

Intentional differences: the demos' global store becomes ARTINOS parameters; their manual renderer calls become frame-scheduled passes; artistic demo defaults are retained as project choices rather than universal material defaults. Negative optical thickness is not exposed. `fresnelIntensity` and `fresnelColor` exist in the mesh demo's settings but are never applied by its material; ARTINOS exposes its functional `specularIntensity` and `specularColor` controls instead. Dielectric F0 in the monitor is the IOR-only reference value, not a measurement of the final shaded pixel. Spectral chart curves show the IOR range; the shader integrates strata within that range.

Validation: automated pass-order/state-restoration, preview render-state isolation and Snell/critical-angle checks live in `tests/`. Build verification uses `npm run build`. Screen-space limits and shared capture sizing above still apply.
