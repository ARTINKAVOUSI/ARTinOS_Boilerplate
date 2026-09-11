# PostFX / RenderPipeline

ARTINOS uses **one Three RenderPipeline** on the shared renderer. Effects register semantically, are ordered numerically, and reuse shared scene resources such as beauty/output, depth, normal and velocity.

## Native local TSL effects

The local reusable collection contains 44 effects. The original 34 plus SSAA, Subsurface Scattering, God Rays, LUT 3D, Transition, Pixelation, Retro, Radial Blur, Bilateral Blur and Recurrent Denoise are registered through the same shared pipeline.

Every catalog entry declares its backend, minimum quality/resolution policy, required runtime resources and precise fallback. Self-contained Three/TSL effects no longer use synthetic readiness flags. LUT 3D and Transition remain disabled with a telemetry reason until their real texture/node resources are registered; SSS and God Rays consume the active lighting rig's registered key light.

Each has a local component under `packages/modules/src/postfx/`, for example:

```tsx
import { Bloom, SSGI, TRAA } from '@artinos/modules/postfx'

<Bloom strength={0.8} threshold={0.85} order={100} />
<SSGI order={300} />
<TRAA order={900} />
```

The Studio PostFX panel can enable/disable every effect, edit parameters, change order, enable/disable the whole chain and apply PostFX presets.

## Provider effects

`@artinos/modules/stdlib` exposes the complete `three-stdlib` root API, including classic WebGL composer/pass utilities. Those WebGL-only composer passes are **not secretly inserted into the native WebGPU RenderPipeline**. Use them explicitly only when intentionally building a separate compatibility path. The default boilerplate remains WebGPU/TSL-first.
