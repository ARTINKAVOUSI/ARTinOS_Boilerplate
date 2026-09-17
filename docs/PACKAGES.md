# Package architecture

- `@artinos/r3f` is the application entry and orchestrator. It owns runtime/provider composition, the single R3F canvas, deterministic project install/dispose, stage composition, telemetry and adaptive quality.
- `@artinos/runtime` is renderer-agnostic state plus the shared R3F renderer bridge. It owns parameters, signals, resources, modules, bindings, automation, quality, telemetry and persistence. Optional PostFX and Three Inspector code are lazy boundaries.
- `@artinos/inputflow` owns device capture and normalized live signals. It has no UI dependency.
- `@artinos/modules` contains reusable scene, lighting, environment, camera, shadow and native TSL PostFX capabilities and presets.
- `@artinos/ui` contains the design language, controls, panels and the docking shell. It observes and edits shared runtime contracts; it does not own renderer or device loops. Four layers — `headless` (behaviours), `primitives` (controls), `shell` (workspace, panel system, command palette), `panels` (runtime views) — where `headless` and `primitives` carry no runtime dependency and can be used in any React project. See [UI.md](UI.md).
- `@artinos/scenes` contains preset, fully configured scenes (first: the Adaptive Room). Its core depends only on React, three and R3F and works in any app; `@artinos/scenes/artinos` is the runtime adapter (parameters, presets, commands, bounds signals). See [packages/scenes/README.md](../packages/scenes/README.md).
- `@artinos/graph` contains the node schema, typed-port validation, registry, templates and the five domain executors. One schema declaration per node type drives validation, execution and the whole editor UI.

The host contains only `src/main.tsx` plus flat `src/*.project.tsx` and `src/*.example.tsx` entries. Startup discovers those files automatically; the R3F package installs the selected entry's parameters, modules, presets, bindings and graphs into one shared runtime before its content participates in the stage.

## Package boundaries

Each package declares one entry point, has a README, typechecks alone, and may only import
the packages listed for its tier:

```text
runtime  →  (nothing)
graph    →  runtime
inputflow→  runtime
modules  →  runtime
scenes   →  (nothing)      scenes/artinos → runtime
ui       →  runtime · graph · inputflow · modules
r3f      →  all of the above
```

`@artinos/ui` additionally may not take third-party dependencies beyond `react`,
`react-dom` and `lucide-react`, so dropping the control kit into another project costs one
install rather than a design-system migration.

`npm run check:packages` enforces all of this — including that no file reaches into a
sibling's `src/` instead of its barrel — and runs as part of `npm run doctor`.
