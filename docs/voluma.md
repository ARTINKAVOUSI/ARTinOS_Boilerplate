# VOLUMA — volumetric fluid / light instrument

VOLUMA is a single-page WebGPU studio for authoring multi-species 3D Eulerian fluid inside a cinematic tank. It runs on the portable ARTINOS React 19 / R3F v10 / Three r185 runtime and uses TSL for both compute and volume rendering. There is no WebGL simulation path, GLSL shader-string solver, CPU volume readback, particle billboard canvas, or second renderer.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5180` in a current Chrome or Edge build with WebGPU available. A WebGPU-capable discrete GPU is strongly recommended above Draft. Production output is created with `npm run build`.

## Engine

The simulation uses separate velocity and species grids. Velocity, pressure, divergence, curl, obstacles, four transported concentration channels, temperature, occupancy/interface metrics, and colored light transmittance are `Storage3DTexture` resources. Each frame runs authored injection, buoyancy and continuum-interface forces, curl, vorticity confinement, spatial viscosity, obstacle-aware divergence, Jacobi pressure, projection, MacCormack forward/reverse correction with extrema clamp, per-channel diffusion/dissipation, temperature transport, occupancy, and a light-volume bake.

The renderer performs a jittered Beer–Lambert volume march with per-channel absorption and scattering, mixed HG phase, emissive contribution, pearlescent `∇C` lobe, baked colored self-shadowing, empty-cell skipping, and early transmittance termination. Carrier extinction remains part of the integral.

Four solver channels represent aqueous ink, dye/emissive, cloudy/paint, and immiscible oil/pearl phases. Ten library recipes map physical and optical profiles into those channels; selecting a vial changes solver viscosity, diffusion, buoyancy, optical thickness, and glow as well as injection composition. The oil/aqueous phase receives CSF curvature force and anti-overlap sharpening.

## Studio workflow

- Play mode exposes carrier, paint, thickness, swirl, glow, and global audio intensity.
- Lab mode exposes viscosity, confinement, buoyancy, diffusion, Jacobi count, quality, all debug views, exposure, and key-light direction/intensity.
- The emitter inspector selects a real compute pattern: ring, twin jets, downward jets, orbit, sheet/ribbon, spectrum stack, fog bed, or tendril. Mass, radius, circulation, material, force coupling, enable, and randomize affect live dispatch.
- Ten scene presets apply distinct carrier, material, solver, emitter-stack, optical, and lighting values, then clear/reseed the volume.
- Pointer modes inject different mass/momentum terms: stir, inject, vortex, and pull. Shift/Alt/Ctrl temporarily select inject/vortex/pull.
- Pause, reset, undo, redo, JSON import/export, and WebM capture are functional. Capture also downloads the matching `.scene.json` sidecar.
- Debug views: species, density, velocity, vorticity, pressure, temperature, occupancy, transmittance, concentration normals, miscibility interface, audio features, and emitter bounds.

## Audio

Demo oscillator, microphone, and local audio-file sources feed one frame-synchronized `AnalyserNode` feature extractor. Microphone access requires a secure origin or localhost and explicit browser permission. Features include bass, low-mid, mid, high-mid, treble, RMS, peak, energy, crest, peak hold, centroid, dominant frequency, spectral flux, onset/beat, and phase.

The ARTINOS graph and binding layer routes features to arbitrary registered parameters. The shipped graph and bindings send bass to ring mass/radius, onsets to circulation, treble to confinement/glow, flux to glow/turbulence response, and energy to exposure. The Audio Intensity macro scales the direct structural modulation in the pipeline.

## Quality tiers

| Tier | Velocity | Species / temperature | Light bake | Jacobi cap | March |
|---|---:|---:|---:|---:|---:|
| Draft | 64³ | 96³ | 32³ | 10 | 56 |
| Live | 96³ | 128³ | 48³ | 18 | 88 |
| Studio | 128³ | 160³ | 64³ | 28 | 136 |
| Hero | 160³ | 192³ | 80³ | 40 | 192 |

Changing quality disposes and rebuilds all GPU resources. Frame delta is clamped and expensive frames use two substeps. The HUD reports ARTINOS FPS/frame time plus solver submission, bake submission, substeps, active resolutions, and Jacobi count. Solver/bake milliseconds are CPU command-submission measurements, not GPU timestamp queries.

See `PLAN.md` for the auditable field/pass map and verification checklist.
