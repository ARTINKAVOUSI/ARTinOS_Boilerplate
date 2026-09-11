# VOLUMA implementation map

This file maps the build contract to the current implementation. The application uses the ARTINOS-owned `WebGPURenderer`, frame coordinator, parameter/signal graph, persistence, telemetry, and R3F canvas. Simulation and rendering share that runtime.

## Source map

- `src/voluma.project.tsx` — schema, scene, ten presets, functional studio controls, audio routes, persistence/capture, and telemetry HUD.
- `src/voluma-fluid.tsx` — dual-resolution field allocation, ordered TSL compute, injection kernels, interactions, solver, transmittance bake, and volume material.
- `src/voluma-authoring.tsx` — declarative tank, palette, emitter, force, audio-reactor, and pointer-sculptor components published as ARTINOS resources.
- `src/voluma-audio.ts` — demo/microphone/file sources and frame-coordinated feature extraction; it owns no animation loop.
- `src/voluma.materials.json` — nine carrier profiles, ten species recipes, optical properties, and miscibility data.
- `src/voluma.presets.json` — portable descriptions of the ten required scenes.
- `src/voluma.css` — responsive Play/Lab instrument chrome.

## GPU fields

| Family | Resolution | Resources | Purpose |
|---|---:|---|---|
| Velocity | tier velocity | state, work, forward, reverse | xyz mixture velocity and MacCormack transport |
| Projection | tier velocity | pressure A/B, divergence | obstacle-aware incompressibility |
| Differential | tier velocity | curl, obstacle | curl xyz/magnitude and wall occupancy |
| Species | tier species | state, emitted, forward, reverse | four linear-mass material channels |
| Thermal | tier species | temperature state/work | temperature injection and advection |
| Occupancy | tier species | occupancy/interface | density, gradient magnitude, oil/aqueous interface |
| Lighting | tier light | colored transmittance | lower-resolution self-shadow volume |

All textures are half-float RGBA 3D storage textures, stay on GPU, and are disposed on quality changes/unmount.

## Dispatch order

1. Active emitter/pointer kernel writes velocity, concentration, and temperature.
2. Buoyancy, gravity response, and oil/aqueous continuum surface force.
3. Curl and vorticity confinement.
4. Spatially varying mixture/carrier viscosity.
5. Obstacle-aware divergence.
6. Quality-capped Jacobi pressure A↔B.
7. Velocity projection.
8. Velocity MacCormack forward/reverse/correction with neighbor extrema clamp.
9. Species MacCormack forward/reverse/correction, per-channel diffusion/dissipation, and immiscible anti-overlap sharpening.
10. Temperature advection.
11. Occupancy and interface metrics.
12. Colored light-space transmittance bake.
13. Jittered Beer–Lambert/HG raymarch with empty skip and early-out.

## Authoring coverage

The declarative emitter schema accepts point, sphere/volume, jet/nozzle/stream, line, ring/radial, spiral/vortex/vortex-ring, orbit, surface/mesh/image-mask/procedural, trail/path/burst, spectrum/spectrum-ring, and group records. The live preset scheduler compiles the shipped scenes into ring, point/volume, anisotropic jet, sheet, orbit, spectrum, fog-bed, and tendril kernels without swapping solvers. Force declarations cover attract/repel, directional/gravity, vortex, turbulence, damping, flow-volume, and audio impulses; the solver evaluates authored injection, pointer force, gravity/buoyancy, confinement, local damping/viscosity, and continuum-interface force directly.

## Verification

- [x] Strict TypeScript project build.
- [x] Vite production bundle.
- [x] WebGPU/TSL-only simulation and volume source path.
- [x] Dual-resolution velocity/species/temperature fields.
- [x] Live pressure projection, confinement, spatial viscosity, and MacCormack transport.
- [x] Four simultaneous channels, ten recipes, carrier profiles, and oil/aqueous CSF + sharpening.
- [x] Colored absorption/scattering, HG phase, emissive/pearl modes, and light-volume self-shadowing.
- [x] Functional presets, pointer modes, Play/Lab controls, debug modes, import/export, capture sidecar, and three audio sources.
- [ ] Runtime WebGPU shader compilation and shot A–D visual acceptance on the target GPU. This must be verified in a WebGPU browser; a JavaScript bundle alone cannot prove WGSL validity or cinematic shot quality.

## Shot-test procedure

1. Start in Draft and confirm WebGPU LIVE plus `64³ → 96³` in the top bar.
2. Single Drop Ink: reset, run three seconds, pause, then inspect Beauty, Curl, and Transmittance.
3. Milk in Water: confirm cloudy scattering and softer internal shadow.
4. Oil Lenses: inject aqueous ink, switch to oil, and confirm interface separation in Beauty and Miscibility Interface.
5. AV Sculpture: start Demo, Mic, or File audio; confirm bass rings, mid spatial alternation, treble confinement, and settling after stop.
6. Repeat at Live/Studio only after Draft is stable; use Hero for capture.
