# ARTINOS Boilerplate Architecture

## Runtime ownership

The boilerplate deliberately centralizes infrastructure. `@artinos/r3f` is the public application orchestrator and `@artinos/runtime/ArtinosCanvas` is the only WebGPURenderer owner. R3F owns scene lifecycle and the frame clock. Three/TSL owns graphics/compute. UI, InputFlow and project modules consume the runtime through semantic registries.

```text
RuntimeProvider
├── ParameterRegistry
├── SignalRegistry
├── BindingEngine
├── AutomationEngine
├── PresetRegistry
├── ResourceRegistry
├── TelemetryBus
├── QualityManager
├── HistoryStore
├── RuntimeLogger
├── ModuleRegistry
└── FrameCoordinator
        │
        ▼
ArtinosCanvas / R3F v10
├── RuntimeFrameBridge
├── RendererTelemetry
├── AdaptiveQuality
├── Scene / Stage
├── Project
└── RenderPipelineSystem
```

## Frame phases

```text
input → signals → parameters → simulation → compute → before-render
                                                     │
                                                     ▼
                                             R3F / RenderPipeline
                                                     │
                                                     ▼
                                            post-render → telemetry
```

Frame tasks are fault-isolated; a failing reusable task is logged and counted without aborting unrelated tasks.

## Hot path rule

High-frequency values remain outside React state:

```text
Audio FFT ──────────► SignalRegistry ─────► simulation / TSL
      └── throttled UI polling ───────────► panels
```

The same applies to pointer, vision, telemetry and modulated parameters.

## Package boundaries

- `@artinos/runtime` — renderer-independent semantic registries plus the single R3F/Three renderer seam, telemetry, quality and RenderPipeline.
- `@artinos/r3f` — public app entry, project install/dispose lifecycle, provider composition, canvas/stage orchestration and shell selection.
- `@artinos/modules` — ARTINOS scene/visual/PostFX families plus Drei/stdlib provider surfaces.
- `@artinos/inputflow` — browser devices, media analysis, semantic signal integration and recording/replay.
- `@artinos/ui` — panels, shells, controls, runtime inspector, workspace, themes, design tokens and styles; never creates a renderer or captures devices.
- `@artinos/graph` — node schema, typed-port validation, registry, templates and the five domain executors.

The host is intentionally thin and flat: `src/main.tsx` discovers `src/*.project.tsx` and `src/*.example.tsx`; each project file contains its manifest and R3F content. A project declares configuration and composition; it never constructs infrastructure. Reusable capability belongs in `packages/*`, not a nested host directory.

## Telemetry ownership

`RendererTelemetry` samples inside R3F's frame/finish phases and publishes batched observations near 10 Hz. Three's native `RendererInspector` is the authority for resolved CPU/GPU profiles and renderer memory; unavailable values remain explicitly unavailable. The dock HUD and Telemetry panel read the same `TelemetryBus` and mutable frame-profile resource. They do not create another timer, renderer or state store.

## Release boundary

`npm run typecheck` and `npm run build` cover the static boundary. Browser QA is the only gate that means anything past that point, because build output cannot prove WebGPU initialization, interaction, responsive docking or visual fidelity. Ownership invariants are enforced by review against `AGENTS.md`, not by tooling.

## Graph domains

`scene`, `signal`, `parameter`, `gpu`, and `render` share one representation and editor but dispatch to distinct executors. Every node type declares its domains, typed ports and fields in one schema, and `validateGraph` rejects unsupported nodes, port type mismatches, over-subscribed inputs and feedback cycles before any mutation runs.

Scene and render graphs include the numeric node set, so a transform channel or a PostFX parameter can be driven by a live signal through the same maths nodes a signal graph uses. Signal, parameter, scene and render graphs evaluate every frame. GPU graphs are scheduled on change: they compile to real TSL nodes when the definition changes and only push uniform values per frame, because rebuilding a node graph each frame forces a pipeline recompile.

A graph that fails is isolated — it records diagnostics, logs once, and leaves the frame and every other graph running. See `GRAPH.md`.

## Reuse rule

Before creating a new capability:

1. existing ARTINOS module/family,
2. extend an existing ARTINOS core,
3. Drei,
4. three-stdlib,
5. Three/R3F/TSL,
6. composition/preset,
7. only then author a new reusable module.
