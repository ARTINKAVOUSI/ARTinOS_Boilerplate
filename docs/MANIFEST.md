# ARTINOS Boilerplate 1.3 — Production Manifest

## Runtime foundation

- React 19.2 with React Three Fiber v10 as the lifecycle and frame authority.
- `@artinos/r3f` as the public application/project orchestrator.
- exactly one Three.js r185 `WebGPURenderer` owner and one shared TSL `RenderPipeline`.
- WebGPU-first rendering with the renderer's supported compatibility backend option.
- deterministic project install/dispose for parameters, presets, bindings, graphs, resources and frame tasks.
- flat host surface: `src/main.tsx` plus directly discoverable `*.project.tsx` and `*.example.tsx` files.
- semantic runtime registries for parameters, signals, automation, history, persistence, resources, logging, telemetry and adaptive quality.

## Reusable package boundaries

- `@artinos/r3f` — application entry, providers, project lifecycle, canvas/stage and shell orchestration.
- `@artinos/runtime` — semantic core, shared renderer seam, frame bridge, telemetry and quality.
- `@artinos/inputflow` — one normalized device/media/signal lifecycle with recording and replay.
- `@artinos/modules` — scene, camera, adaptive environment, IES/probe lighting, shadows, content and 44 native TSL PostFX components.
- `@artinos/ui` — the complete token, control, panel, inspector and responsive docking language.
- `@artinos/graph` — schema-driven node system: typed ports, cycle-safe validation, templates, and distinct numeric, scene, TSL and render-controller executors.

## Creative systems

- 14 scene presets; parametric environment/background/ground/fog; perspective and orthographic camera/lens views; orbit/map/trackball/fly/camera/pointer-lock controls; lighting rigs, custom light collection and six shadow modes.
- 44 local reusable PostFX components registered into the single shared pipeline with capability, resource, quality and fallback metadata.
- pointer/touch/pen, keyboard, gamepad, wheel, viewport, microphone/audio-file analysis, webcam motion/color analysis, worker-first MediaPipe hand/face/pose/gesture/object vision, Web MIDI and DeviceOrientation.
- persistent responsive workspace with Inspector, Scene, PostFX, InputFlow, Graph and Telemetry panels plus the full supporting collection.
- ARTINOS semantic/object inspection and Three's official WebGPU Inspector attached to the same renderer.
- compact runtime HUD and detailed Telemetry panel backed by real R3F/Three measurements, bounded histories and honest unavailable states.

## Checks

Run from the boilerplate root:

```bash
npm install
npm run doctor
npm run typecheck
npm run build
npm run dev
```

`doctor` reports the environment and capability inventory, `typecheck` enforces strict TypeScript across every workspace, and `build` proves the production module graph resolves.

The browser is the real gate and it is manual. For any UI or runtime change, confirm in a current WebGPU-capable browser: WebGPU initialization, live scene output, a clean console, the four primary panels, native inspector launch, PostFX interaction, InputFlow permission boundaries, responsive narrow layout and bottom/left/right docking.

There is no automated test suite or source verifier. The ownership invariants — one `WebGPURenderer`, one frame loop, one shared `RenderPipeline` — are documented in `AGENTS.md` and enforced only by review.

## Known engine note

Three's native Inspector may emit one non-fatal startup warning while attaching around the first R3F frame. It does not create another renderer or loop, and resolved CPU/GPU profiles remain the source of truth once frames begin. Treat any additional or repeated warning/error as a release failure.
