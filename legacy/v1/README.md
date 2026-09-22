# ARTINOS Studio 1.4

A React 19 / React Three Fiber workspace for interactive 3D projects. The studio combines a live viewport, dockable editor panels, typed parameter controls, signal routing, automation and a shared render pipeline.

## Run

Use the checked-in pnpm workspace and lockfile:

```sh
pnpm install
pnpm dev
```

Open http://localhost:5180/?project=ui-platform for the main UI project. Other projects are available with `?project=default`, `?project=persian-garden` and `?project=voluma`. The most recently selected project is remembered in this browser. `?showcase` opens the component library.

The renderer uses WebGPU when available. The separate VOLUMA fluid project requires WebGPU; see [its engine and workflow notes](docs/voluma.md).

## Studio workflow

- **Inspector:** search and group project controls, edit precise values, star or pin essentials, and save named looks. Presets capture the visible controls, including active filters.
- **Scene:** atmosphere, environment, camera, navigation, lighting, shadows, output, scene objects and project files. Advanced controls are optional; irrelevant controls follow their switches.
- **PostFX:** browse effects or work in the active stack, inspect availability, bypass the pipeline and reorder effects with undoable changes.
- **InputFlow:** connect devices, monitor or freeze signals, shape signal routes, create command triggers, and record/replay signals.
- **Graph:** inspect live connections or edit authored graphs in the existing node editor.
- **Timeline:** author numeric tracks, change duration and looping, insert or replace keys, and edit values and easing. Key time is an insertion time; playback follows runtime time.
- **Assets:** choose or drop files, inspect previews and sizes, search and filter. Imported file resources last for the current session.
- **Library:** search reusable modules and copy canonical module paths.
- **Console:** search/filter messages, pause the display, and expand complete messages and diagnostic data.
- **Telemetry:** performance overview, resources and the native renderer inspector.
- **UI DevTools:** inspect registered components, live state, tokens and accessibility metadata.

Every studio panel includes a Guide. The dock toolbar can expand the current workspace panel. Panels still support detaching and docking through MetaBlock. Arrow keys, Home and End navigate the shared panel tabs. Search uses Ctrl/Cmd+K.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm doctor
pnpm build
```

Node 20+ runs the app tooling; the regression-test loader currently requires Node 22.15+ (verified with Node 24). `doctor` checks package entry points and installed essentials. `clean` clears TypeScript build outputs. `preview` serves the production build.

TypeScript preserves workspace symlinks to resolve the installed React/Three types consistently with pnpm. Rendering dependencies remain at the declared versions; this upgrade does not migrate the WebGPU engine to a new alpha release.

Read [the upgrade audit](docs/STUDIO-UPGRADE.md) for changes, verification and remaining limitations. Original UI sources from before this pass are saved locally in `.upgrade-backup/ui-src`.
