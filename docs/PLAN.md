# ARTINOS v2 — Rebuild Plan

The plan for rebuilding the ARTINOS boilerplate (v1.4: `packages/*` and `src/*.project.tsx`, preserved at the git tag `v1.4-final`) as a set of copy-pastable React units, following `.claude/skills/copy-pastable-reusable-react/SKILL.md`. It covers the contract every unit follows, the folder layout, a v1 → v2 inventory with the status of every item, the boundary audit and its fixes, and the cut-over.

**Status as of 2026-09-22** (branch `v0.5-dock`): **complete.**

- Phases 0–6 and **6A (boundary fixes)** are done. Every unit listed in [§6](#6-boundary-audit) can be deleted and the app still type-checks and builds.
- Scope decision (2026-09-21): the extra features, panels, UI-kit remainder, Timeline, presets, VOLUMA and the automated-check work that the previous revision planned as phases 7–10 are **not needed** and have been dropped (listed in [§7](#7-inventory-v1--v2) as ✂).
- **Phase 11, the cut-over, is done:** v2 is the repository root; v1 lives on at the tag `v1.4-final` (the `legacy/v1/` copy was dropped on 2026-10-01; see [§8](#8-phases)).

---

## 1. Goals

1. **Every capability is one file or one folder.** One PostFX effect, one UI control, fog, the camera, orbit controls, one input device, the glass material: each is a unit you can copy into another project, or delete, without editing anything else.
2. **Adding or removing a feature or a panel needs no wiring.** A file under `src/features/` that exports a `feature` manifest shows up in the scene and in the studio. A file under `src/panels/` that exports a `panel` manifest becomes a dock tab. Delete it and it is gone, including its saved state.
3. **The components stay portable.** A feature component takes normal React props. Its only link to this app is a `feature` manifest typed with `import type`, which disappears at build time.
4. **No shared framework.** The v1 package layers (`@artinos/runtime`, `r3f`, `ui`, …) are gone. Where a small shared piece is genuinely needed (the PostFX host, the signal bus), it is one file and each unit that needs it names it.
5. **Same stack, same studio.** React 19.2, three 0.185.1 (WebGPU + TSL), R3F 10 alpha, drei 11 alpha. The studio is the original one: MetaBlock dock, `plate-*` chrome, embedded performance HUD, brand chip, the ARTINOS stylesheet and its six material worlds.

### What changes from v1

| v1 | v2 |
|---|---|
| 7 workspace packages with tier rules and a package doctor | 1 package; folders instead of packages |
| `RuntimeProvider` with 12 registries | Features take props. The studio store holds values and passes them in. Live values go through one signal bus. |
| A central `postfx-pipeline.tsx` `switch` over 44 effect types | Each effect file builds its own TSL node and registers with `<PostFX>` |
| Glass capture passes hard-wired into the pipeline | The glass folder registers its own passes with `usePostFXPass` |
| 2-line effect wrappers plus a separate catalog | One file per effect: component, props, docs and studio controls together |
| `*.project.tsx` manifests listing parameters, graphs and bindings | Features discovered from `src/features/**` |
| UI kit that needed the global `theme.css` and a kernel/registry | Each component folder has its own scoped CSS with fallbacks; no kernel |
| `@artinos/metablock` package + `MetaBlockShell` with a hard-coded panel list | The same engine as one folder (`src/ui/MetaBlock/`); panels discovered from `src/panels/` |
| Parameter changes rebuilt the whole pipeline | Numeric effect settings are live GPU uniforms (`useUniform`) |

---

## 2. Status at a glance

| Area | Count | Status |
|---|---:|---|
| App core (contract, discovery, store, boundaries, stage) | — | ✅ |
| Canvas + PostFX host (with pass providers) | — | ✅ |
| PostFX effects | 46 | ✅ 44 v1 effects + SubsurfaceScattering + GraphEffect |
| Scene features | 16 | ✅ incl. Light, Shadows, Gizmo (the three.js Inspector became the Console's profiler views) |
| Objects / materials | 8 + glass folder | ✅ |
| Input devices | 8 | ✅ pointer, keyboard, microphone, hands, camera, MIDI, gamepad, tilt |
| Overlays | 2 | ✅ Stats HUD, Signal Monitor |
| Studio panels | 8 | ✅ |
| UI kit | ARTINOS UI (13) + 17 + MetaBlock + NodeGraph | ✅ |
| Boundary fixes (§6) | 8 | ✅ phase 6A |
| Cut-over (v2 replaces the root) | — | ✅ phase 11 |

---

## 3. Architecture

```text
index.html → src/main.tsx → <App>
                             ├── <Stage>                       src/app/Stage.tsx
                             │    └── <WebGPUCanvas>            features/canvas   (the only renderer owner)
                             │         └── <PostFX enabled>     features/postfx   (canvas-provider, always mounted)
                             │              ├── scene features   kind: 'scene'
                             │              └── effect features  kind: 'effect'
                             ├── app features                  kind: 'app'       (inputs; mounted beside the stage)
                             ├── overlay features              kind: 'overlay'   (DOM HUDs; get renderer + backend)
                             └── <DockShell>                   src/app/studio    (MetaBlock workspace)
                                  ├── locked fullscreen viewport  → the stage above
                                  ├── dock.bottom (persistent)    → one tab per src/panels/*.tsx
                                  ├── floating / split groups     → panels dragged out of the dock
                                  ├── dock toolbar                → tabs · search (⌘K) · expand · RuntimeHUD
                                  └── brand chip · console toast · command palette
```

The canvas is a locked fullscreen MetaBlock group under everything. Panels are MetaBlocks inside a persistent dock group: any tab can float, merge, split, return to its exact tab position, or maximize. The arrangement is saved (`artinos.v2.dock`) and restored while it still matches the panels on disk.

### 3.1 The feature contract (`src/app/feature.ts`)

```ts
export const feature: Feature = {
  id: 'scene.fog',               // unique and stable; saved state is keyed by it
  label: 'Fog',
  kind: 'scene',                 // 'app' | 'canvas-provider' | 'scene' | 'effect' | 'overlay'
  group: 'Atmosphere',           // studio section
  category?: 'blur',             // effects: grouping in the "Add effect" menu
  order: 25,                     // mount order; for effects, the chain position
  enabled: false,                // default state
  cost?: 'high', webgpuOnly?: true,
  controls: {                    // generates the studio UI and the default props
    mode:  { type: 'select', value: 'linear', options: ['linear', 'exponential'] },
    color: { type: 'color',  value: '#1a1c1f' },
    near:  { type: 'number', value: 8, min: 0, max: 100, step: 0.1 },
  },
  component: Fog,
}
```

Control types: `number` → Slider, `boolean` → Switch, `select` → Select, `color` → ColorField, `vector3` → three NumberFields, `text` → TextField (applied on Enter or blur).

Mount rules:

- **app**: outside the canvas, beside the stage, so switching one never remounts the scene.
- **canvas-provider**: wraps the scene inside the canvas, stays mounted and receives `enabled`, `attachments` and `onStages`.
- **scene / effect**: inside the canvas. Effects render only when the `PostFX` host exists.
- **overlay**: DOM over the canvas; also receives `renderer` and `backend`.

Each feature runs inside a `FeatureBoundary` (error boundary + Suspense). A crashing feature renders nothing and shows a toast; changing its props retries it.

### 3.2 Feature inspectors (`FeatureInspector` in `src/app/feature.ts`)

A feature folder can ship its own studio section by exporting `inspector` from any `.tsx` file under `src/features/`:

```ts
export const inspector: FeatureInspector = {
  id: 'glass',
  features: ['object.glass-rings', 'object.glass-mesh'], // shown for the first one switched on
  component: GlassInspector,                              // gets { featureId, values, peer, setEnabled }
}
```

The Inspector panel renders it. It lives in the feature's folder, so deleting the folder removes it. It receives its state as props because **a file under `src/features/` must never import `app/store` or `app/registry`**: the registry loads every feature file, so that import is circular and crashes at startup.

### 3.3 The panel contract (`src/app/panel.ts`)

```tsx
export const panel: PanelManifest = {
  id: 'scene', title: 'Scene',
  description: 'Environment, camera, lighting…',  // tab tooltip + palette
  keywords: ['camera', 'fog'],                    // palette search
  order: 1, dock: 'bottom', active: true,
  owns: feature => …,                             // features this panel shows (palette jump target)
  footer: () => <>ENVIRONMENT · CAMERA</>,
  component: Scene,
}
```

Discovered with `import.meta.glob('../panels/*.tsx')`. Every body is wrapped in `PanelWorkbench` (portrait/landscape container, `--panel-height`, error boundary with Retry). Panels share only `src/app/studio/` building blocks (`FeatureCard`, `FeatureTile`, `CardFlow`, `ControlInput`, `PanelBar`, `LiveInspector`, `files`, `icons`), never each other. Only the active tab of each dock group is mounted, and the dock hands the workspace the same panel element on every render, so focus clicks, drags and resizes never re-render a panel body.

### 3.4 Discovery (`src/app/registry.ts`)

`import.meta.glob('../features/**/*.tsx', { eager: true })`. Modules exporting `feature` become features; modules exporting `inspector` become Inspector sections; everything else (`GlassMaterial.tsx`, `WebGPUCanvas.tsx`) is loaded and ignored. Incomplete manifests and duplicate ids are skipped with a warning. Only `.tsx` files are scanned.

### 3.5 State (`src/app/store.ts`)

A plain external store (`useSyncExternalStore`) saved to `localStorage` (`artinos.v2.studio`, versioned):

- `features[id] = { enabled, values, order }`
- `presets[name]` = snapshots of `features` (save, load, delete, export, import, reset)
- `ui = { visible, theme, advanced }`
- `reconcile()` drops saved state for features or controls that no longer exist.

Features never read the store; the app passes values as props. Each feature is mounted by a `FeatureMount` (`src/app/Stage.tsx`) that subscribes to that feature's state alone, so a slider drag re-renders one feature, not the scene.

### 3.6 Render pipeline (`src/features/postfx/PostFX.tsx`)

- Owns one `RenderPipeline` and one scene `pass()`. MRT attachments (normal, packed normal, velocity, metalness/roughness) are requested only while an active effect needs them, or while `attachments` asks for them.
- `usePostFXEffect(id, { order, needs, webgpuOnly, build }, deps)` registers an effect; `build(ctx)` returns the new image node or `null`.
- `useUniform(value)` returns a stable TSL uniform, so slider drags never recompile.
- `usePostFXPass(id, provider)` registers extra scene passes. `provider.create({ scenePass, scene, camera, renderer })` runs whenever the scene pass is built, may wrap it, and returns `{ value, update?, dispose? }`; every component registered under the same id receives `value`. The glass material uses this for its backdrop and clean captures. PostFX itself knows nothing about glass.
- `onStages(stages)` reports every stage (scene pass, each effect, attachments, output) each time the chain is built. The Stage forwards them to `app/pipeline-stages.ts` for the Graph panel.
- Each build is wrapped in `try/catch`; on WebGL2, `webgpuOnly` effects are skipped. Intermediate nodes are disposed on rebuild; passes, providers and the pipeline on unmount.

### 3.7 Systems in `src/app/`

| File | What it is |
|---|---|
| `signals.tsx` | The `SignalBus` (`set`, `get`, `delete(prefix)`, `age`, `entries`), the default bus, `<SignalsProvider>`, `useSignals`, `useSignalSnapshot(hz)`, `useSignalCleanup`. Inputs write, objects read in `useFrame`, no React renders. |
| `webcam.ts` | The shared camera element, so CameraInput and MediaPlane never open the camera twice. |
| `runtime.ts` | One rAF sampler: fps, frame-time history, renderer counters. |
| `console.ts` | `console.*` capture for the Console panel and the toast. |
| `pipeline-stages.ts` | The last-built pipeline stages and the attachments the Graph panel wants. |
| `compiled-graphs.ts` | Compiled GPU graphs, read by the GraphEffect. |
| `graphs.ts`, `live-graph.ts`, `node-preview.ts` | The Graph panel's authored graphs, live pipeline view and GPU thumbnails, on top of `ui/NodeGraph`. |

---

## 4. Folder layout

```text
(repository root)
├── index.html · package.json · pnpm-workspace.yaml · tsconfig.json · vite.config.ts
├── CLAUDE.md          the rules; points at the skill
├── .claude/           the skill + launch config
├── public/            backgrounds/ hdr/ models/ draco/ mediapipe/{wasm,models}
├── docs/PLAN.md       this file
├── docs/reference/    PRD, visual references, design zips
└── src/
    ├── main.tsx
    ├── app/                         host and systems; never edited to add a feature
    │   ├── feature.ts registry.ts panel.ts store.ts runtime.ts console.ts
    │   ├── signals.tsx webcam.ts pipeline-stages.ts compiled-graphs.ts
    │   ├── graphs.ts live-graph.ts node-preview.ts
    │   ├── Stage.tsx App.tsx FeatureBoundary.tsx app.css
    │   └── studio/  DockShell RuntimeHUD ConsoleToast PanelWorkbench PanelBar FeatureCard
    │                PresetMenu DockMenu ControlField LiveInspector CardFlow layout icons dock.css panels.css components.css
    │                skin/  the original ARTINOS stylesheet
    ├── panels/      8: Inspector Scene PostFX InputFlow Graph Assets Library Console (telemetry and appearance live in the studio bar)
    ├── ui/          one flat system (README.md): system/ (tokens, themes, anatomy, helpers) + one sibling
    │                folder per component, <Name>/<Name>.tsx + <Name>.css — 29 components incl. MetaBlock, NodeGraph
    └── features/
        ├── canvas/WebGPUCanvas.tsx
        ├── postfx/PostFX.tsx  effects/*.tsx (46)
        ├── scene/*.tsx (16)
        ├── objects/*.tsx (8) + glass/ (GlassMaterial, GlassInspector + css, glass-capture,
        │                               transmission-nodes, glass-optics, glass-parameters)
        ├── input/*.tsx (8)
        └── overlays/*.tsx (2)
```

---

## 5. Rules each unit follows

1. **Boundary:** one `.tsx` (plus one `.css` where it has styles). A folder only when a single file would be hard to follow; every file in it is one someone would open on its own.
2. **Imports:** npm packages, `src/app/*` contracts and systems, `src/ui/*` components, and files inside its own folder. A feature never imports another feature, except the declared host `postfx/PostFX.tsx` (effects, the glass material). A panel never imports another panel. A `src/ui` component never imports outside its folder. **`src/app` never imports a feature.**
3. **No store or registry in features:** files under `src/features/` never import `app/store` or `app/registry` (circular; see §3.2).
4. **Styles travel with the component:** classes prefixed `aui-<name>`; private variables declared inside `:where(.aui-x) { --_ink: var(--ui-ink, <fallback>) }` so it renders without `theme.css`.
5. **Declared dependencies:** each file's doc comment lists what it needs (three ≥ 0.185, R3F 10, drei 11, MediaPipe, and a local host file where there is one).
6. **Cleanup:** every rAF loop, media stream, AudioContext, worker, texture, geometry, pass and pipeline is released on unmount.
7. **Canvas ownership:** only `WebGPUCanvas` creates a canvas. Every 3D feature mounts inside the existing one.
8. **Renderer order:** TSL on WebGPU, WebGL2 fallback through `WebGPURenderer`; a message instead of a blank canvas when neither works.
9. **Accessibility:** native elements where possible; ARIA roles and full keyboard support otherwise; visible focus; `prefers-reduced-motion` respected.
10. **No demos inside units.** Usage lives in a doc-comment snippet.

### How to copy a unit into another project

| Unit | Copy | Also needs |
|---|---|---|
| UI component | `src/ui/<Name>/` | `react`, `react-dom`, and `src/ui/system/` (import `system.css` once) |
| Docking engine | `src/ui/MetaBlock/` | `react` |
| Node graph editor | `src/ui/NodeGraph/` | `react`, `three` (GPU domain) |
| PostFX effect | `features/postfx/PostFX.tsx` + `effects/<Effect>.tsx` | `three`, `@react-three/fiber`; mount `<PostFX>` in your canvas |
| Scene feature | `features/scene/<Name>.tsx` | `three`, R3F; drei for Camera, Controls, Environment, Gizmo |
| Glass | `features/objects/glass/` minus `GlassInspector.*`, + `PostFX.tsx` | `three`, R3F |
| Reactive object / input device | the feature file + `app/signals.tsx` | MediaPipe for HandTracking |
| Media plane / camera input | the feature file + `app/webcam.ts` | — |
| Canvas | `features/canvas/WebGPUCanvas.tsx` | `three`, R3F |
| Studio panel | `src/panels/<Name>.tsx` | this app's `src/app/studio/` blocks (panels are app-bound by design) |

Outside this app, delete the `export const feature` block and its `import type`, or keep it; it has no runtime effect. Files that import `app/signals` or `app/webcam` need that one import path fixed after pasting. `GraphEffect` reads `app/compiled-graphs` by default; pass it a `node` prop and drop that import to use it elsewhere.

---

## 6. Boundary audit

Found by tracing every import in `src/` on 2026-09-21; all fixed the same day (phase 6A).

| # | Problem | Fix |
|---|---|---|
| A1 | The app (`Stage`, `graphs`, `live-graph`, `LiveInspector`) and two panels imported the signal bus from `features/input/`; deleting that folder broke the app. | Moved to `src/app/signals.tsx`, a system. |
| A2 | `PostFX.tsx` imported `app/pipeline-stages`, so it could not be copied with one effect. | `onStages` and `attachments` props; the Stage wires them to `pipeline-stages`. |
| A3 | `PostFX.tsx` imported and always built the glass capture passes. | Generic `usePostFXPass`. `glass-capture.ts` moved into `objects/glass/` and exports the `glassPasses` provider; passes exist only while glass is mounted. |
| A4 | `app/studio/GlassInspector.tsx` imported glass files; deleting the glass folder broke the Inspector panel. | Moved to `objects/glass/GlassInspector.tsx` (+ its CSS, out of `dock.css`) as an `inspector` export; the Inspector panel renders inspectors generically. |
| A5 | `GlassMaterial` imported a glass-specific hook from PostFX. | Uses `usePostFXPass('glass', glassPasses)` from the declared host. |
| A6 | `MediaPlane` imported `features/input/webcam`. | Moved to `src/app/webcam.ts`. |
| A7 | `ui/workspace/NodeGraph/LiveGraphView` imported `NumberField` and `Toggle` from sibling folders. | Local native inputs styled by `NodeGraph.css` (`.ngraph-number`, `.ngraph-check`). |
| A8 | `GraphEffect` could only read the studio's compiled graphs. | Optional `node` prop and a header note. |

Also: `ThreeInspector` (kind `scene`) moved from `overlays/` to `scene/`; the stray empty file `v2/1` deleted; stale path comments fixed. The remaining `any` casts (GlassMaterial 4, transmission-nodes 1, MetaBlock core 3) are where `@types/three` 0.185 lacks the node-material and pass members they touch; they stay.

**Deletion test (passed 2026-09-21).** Each of these was removed in turn, then `tsc --noEmit` and `vite build` were run; both passed every time:

- `features/input/`
- `features/objects/glass/` + `GlassRings.tsx` + `GlassMesh.tsx`
- `features/objects/MediaPlane.tsx`
- `features/postfx/effects/GraphEffect.tsx`
- `panels/Graph.tsx`
- `features/overlays/`
- `features/scene/ThreeInspector.tsx`

---

## 7. Inventory: v1 → v2

Legend: ✅ done · ✂ not ported (by design, or not needed per the 2026-09-21 scope decision)

### 7.1 Packages

| v1 package | v2 location | Status |
|---|---|---|
| `@artinos/runtime` | `features/canvas`, `features/postfx/PostFX.tsx`, `app/store.ts`, `app/runtime.ts`, `app/signals.tsx`, overlays | ✅ (bindings, automation, history, adaptive quality ✂) |
| `@artinos/r3f` | `app/*`, `app/studio/*`, `src/panels/*` | ✅ 5 panels + the studio bar (the rest ✂, §7.7) |
| `@artinos/modules` | `features/scene`, `features/postfx/effects`, `features/objects` | ✅ |
| `@artinos/inputflow` | `features/input/*` | ✅ 8 devices (the rest ✂, §7.5) |
| `@artinos/ui` | `src/ui/*` | ✅ 29 components (the rest ✂, §7.8) |
| `@artinos/graph` | `src/ui/NodeGraph/` + `app/graphs.ts` etc. | ✅ |
| `@artinos/metablock` | `src/ui/MetaBlock/` | ✅ (`MetaBlendPreview` ✂, unused) |
| `src/*.project.tsx` | features | ✅ ui-platform as the default scene; default, persian-garden, VOLUMA ✂ |

### 7.2 PostFX — 46 ✅

| Category | Effects |
|---|---|
| Light | Bloom, WideBloom (v1 `Anamorphic`), LensFlare, GodRays, SubsurfaceScattering |
| Lens | DepthOfField, ChromaticAberration, Vignette |
| Color | Sepia, Grayscale, HueShift, Saturation, BleachBypass, Posterize, Sharpen, ColorGrade (3D LUT) |
| Blur | GaussianBlur, BoxBlur, HashBlur, RadialBlur, BilateralBlur |
| Stylize | DotScreen, FilmGrain, RGBShift, SobelEdges, Scanlines, ColorBleeding, Pixelation, RetroPS1 |
| Temporal | AfterImage, MotionBlur, Transition |
| Screen-space | SSR, SSGI, AmbientOcclusion (GTAO), ScreenSpaceShadows, Denoise, RecurrentDenoise, Outline |
| Anti-aliasing | FXAA, SMAA, TRAA, TAAU, FSR1, SSAA |
| Graph | GraphEffect |

Fixed compared to v1: SSR/SSGI/GTAO composite as three.js documents; Outline builds visible and hidden edge colours; LUT and Transition need no external resource registry.

### 7.3 Scene — 16 ✅

RenderSettings · Shadows · Camera (8 framings, persp/ortho) · Controls (orbit / map / trackball / camera-controls / none) · Environment · Background · Sky · Stars · Fog · Lighting (8 rigs, Kelvin) · Light (ambient, hemisphere, directional, point, spot, IES, probe) · Ground · ContactShadow · Grid · Gizmo · Adaptive Stage (room, cyclorama, apse, niche; optional pedestal).

✂ Water, Reflector, AdaptiveQuality (the HUD keeps its manual quality tiers), v1 `View` (multi-viewport). v1 `Presentation`, `Stage`, `CameraTarget` are covered by Camera framings + Controls.

### 7.4 Objects and materials — ✅

Glass material folder (spectral transmission, backdrop + clean passes, dispersion, volume, diagnostics) · GlassRings · GlassMesh · Model (glTF + Draco) · MediaPlane · Content. (ReactiveOrb, SignalParticles, SceneText and BackdropImage removed 2026-10-01.)

### 7.5 Input — 8 ✅

| Device | Signals |
|---|---|
| Pointer | `pointer.*` |
| Keyboard | `key.*`, `keys.axisX/Y` |
| Audio (microphone) | `audio.level/bass/mid/treble/beat` |
| Hands (MediaPipe) | `hand.<i>.x/y/pinch/open` |
| Camera | `camera.luma/motion/r/g/b` |
| MIDI | `midi.cc.<n>`, `midi.note.<n>`, `midi.bend` |
| Gamepad | `pad.*` |
| Device tilt | `tilt.*` |

✂ Audio file/demo sources and v1's extra bands, pointer pressure/tilt/wheel, face/pose/gesture/object vision, OSC/WebSocket signals, signal recorder.

### 7.6 Runtime systems

| v1 system | v2 |
|---|---|
| Parameters, persistence, presets | ✅ `app/store.ts` |
| Signals | ✅ `app/signals.tsx` |
| Logger | ✅ `app/console.ts` |
| Telemetry | ✅ `app/runtime.ts` |
| Frame coordinator / scheduler | ✂ R3F owns the loop |
| Resources, modules, unit and parameter-type registries | ✂ discovery + manifests replace them |
| Quality manager | ✅ manual tiers in the HUD; adaptive ✂ |
| History, bindings, automation, agent API | ✂ (the dock keeps its layout undo; signal → parameter routing is done with graphs in the Graph panel) |
| Interactions / commands | ✅ the command palette; v1 action registry ✂ |

### 7.7 Studio panels — 5 ✅ + the studio bar

| Panel | Replaces v1 |
|---|---|
| Inspector — the parameters of every active component, in catalogue order; feature `inspector` sections ride in their card | InspectorPanel, ParametersPanel, PresetsPanel, GlassInspector |
| Library — every component by category (`app/studio/catalogue.tsx`), Add / Inspect / Remove, plus session assets and the source kit | ModulesPanel, ScenePanel, RenderPanel, PostFXPanel, AssetBrowserPanel, ResourcesPanel |
| InputFlow | InputPanel, SignalsPanel, ProviderPanel |
| Graph | GraphPanel + graph/* |
| Console | ConsolePanel, ThreeInspectorPanel (Performance and Memory views) |
| *studio bar* (`app/studio/RuntimeHUD.tsx`, not a panel) | TelemetryPanel; appearance settings |

✂ Scene Tree, Object Inspector, History, Bindings, Timeline/Automation, UI DevTools, Quality, Project, Interaction, MinimalShell, Agent.

### 7.8 UI kit — ARTINOS UI + 17 ✅ + MetaBlock + NodeGraph

**Controls (2026-09-28):** the ARTINOS UI package (since 2026-09-30 folded into the flat `src/ui/`, see below) exported with its own `artinos.mjs export` (themes `frost-deep`, `frost-etched`, every component): `Slider RangeSlider NumberField Switch ToggleGroup Segmented ColorField Select Panel Section Field Tabs RollingValue`. `main.tsx` imports its `artinos.css` once; `DockShell` puts `data-ar-theme` on `<html>` from `studio.ui.theme` (Appearance panel); `app/studio/skin/frost-themes.css` retunes the dock glass per theme. They replace the old `Slider Toggle Select Segmented Tabs Panel ColorField VectorField NumberField Section Field Checkbox` folders (a vector control is three kit `NumberField`s). Re-export over the folder with `--force` to add themes; the only local edit is the `as` tag narrowing in `core/Theme.tsx` and `layout/Panel.tsx` (R3F's JSX augmentation makes `ElementType` uncallable).

**One system (2026-09-30):** `src/ui/` is flat. `src/ui/system/` holds the foundation (fonts, tokens, themes, materials, the shared anatomy CSS, and the helpers `utils` `hooks` `options` `Theme` `RollingValue`) and is imported once as `system.css`; every component is a sibling folder that imports only itself and `../system/`: the kit controls (`Slider` with `RangeSlider`, `NumberField Switch ToggleGroup Segmented ColorField Select Panel Tabs`, each with its own stylesheet split out of the kit's shared ones) and the rest (`Badge Button CommandPalette Dialog FileDrop IconButton Kbd Knob Menu Meter PropertyRow Sparkline TextField Toast Toolbar Tooltip XYPad`, rebuilt on the same tokens and anatomy, `ar-` prefix), plus `MetaBlock` and `NodeGraph`. The kit's barrel `index.ts` is gone; its docs moved to `docs/ui/`. `theme/theme.css` is gone. The studio accent is the signal teal (`--ui-sig: var(--ar-signal)`).

**Studio scale (2026-09-29):** the studio reads as one system with the kit. `skin/tokens.css` points `--ui-face` / `--ui-num` at the kit's Chivo / Chivo Mono, sets the control height to 26px (small 22px) and lifts the ink. `app/studio/panels.css` is the one design for panel contents — caps 9px mono · meta 10.5 · label 12 · name 13.5 · figure 22, one card surface, a 104px label column that a paired kit slider shares, container queries per panel width — and `dock.css` restyles the strip (11.5px tabs with a white underline, 26px search, mono HUD). Rows are `PropertyRow` + a kit control; sliders use `layout="paired"` so every row has the same label column. Feature cards are packed by `CardFlow` (shortest column first, 320–600px columns, never more columns than cards), because CSS `columns` balances by height and one tall card left the rest of a wide dock empty; every other grid is `auto-fit`, so tiles, stats and entries fill the panel edge to edge. `components.css` puts the studio's own `src/ui` components (Button, TextField, IconButton, Meter, Kbd, Badge, Menu, Dialog, Toast) on the kit's material — buttons are insert chips like a segmented option, text fields are wells, menus are the kit's floating sheet — so nothing in a panel has a style of its own. The `--pn-*` scale variables sit on `.artinos-workbench-content`, not on the container itself, because a container query cannot restyle its own container.

✂ The v1 remainder (RadioGroup, Combobox, Accordion, ColorWheel/Area, GradientEditor, CurveEditor, EnvelopeEditor, Joystick, Waveform, Dial, RangeSlider, Popover, ContextMenu, Drawer, virtual lists, TreeView, KeyCapture, …), the kernel (`lattice`, `physics`, `schema`, `serialization`, `registry`), `token-graph`, the devtools provider, `headless/*` hooks, the v1 shell (replaced by MetaBlock + `DockShell`) and the `showcase`/`UIStudio`.

---

## 8. Phases

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold: Vite 6, TS 5.8 strict, pnpm, assets, launch config | ✅ |
| 1 | App core: feature contract, discovery, store, boundaries, stage | ✅ |
| 2 | Render: `WebGPUCanvas`, `PostFX` host, 44 effects | ✅ |
| 3 | Scene, objects and overlays | ✅ |
| 4 | Input: signal bus, pointer, keyboard, audio, hands | ✅ |
| 5 | UI kit + studio shell | ✅ |
| 5b | MetaBlock dock, original skin, HUD, section panels | ✅ |
| 6 | Glass, media, MIDI, gamepad, tilt, camera, text, gizmo, light, SSS, graph effect, Graph panel | ✅ |
| 6A | Boundary fixes (§6) | ✅ |
| 7–10 | Extra features, panels, UI kit, timeline, examples, automated checks | ✂ not needed |
| 11 | Cut-over: v2 becomes the repository root | ✅ |

### Phase 11 — cut-over

Done 2026-09-22:

1. Tagged the v1 state as `v1.4-final` (commit `baf93f4`).
2. Moved `v2/*` to the repository root with `git mv`, keeping history.
3. Archived v1 in `legacy/v1/` with `git mv` instead of deleting it (`packages/`, `src/`, `tests/`, `scripts/`, `public/`, `docs/*.md`, configs and lockfile). It is not part of the build or the typecheck.
4. Moved the PRD, `VISUAL_REFERENCES` (tracked and untracked images) and the two design zips to `docs/reference/`.
5. Pointed `.claude/launch.json` at the root (`artinos` on 5190, `artinos-alt` on 5191).

6. Deleted the leftovers: the old `v2/` and `packages/` folders (build output only by then), `.upgrade-backup/`, `vite.log` and `tsconfig.app.tsbuildinfo`.

The root now holds only the project: `src/ public/ docs/ .claude/ index.html package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vite.config.ts CLAUDE.md README.md`.

`legacy/v1/` was kept at first and dropped on 2026-10-01, together with the untracked `UI template/` and `artinos-ui-design-specification/` folders beside the project. Everything v1 had is in the `v1.4-final` tag.

Still to do when you want it: merge to `main` through a PR.

---

## 9. Dependencies

| Package | Version | Used by |
|---|---|---|
| react / react-dom | 19.2.0 | everything |
| three | 0.185.1 | canvas, postfx, scene, objects, NodeGraph GPU domain |
| @react-three/fiber | 10.0.0-alpha.2 | canvas and every 3D feature |
| @react-three/drei | 11.0.0-alpha.5 | Camera, Controls, Environment, GlassRings/Model, Content, Gizmo |
| @mediapipe/tasks-vision | 0.10.35 | HandTracking (lazy chunk) |
| typescript ~5.8, vite ^6, @vitejs/plugin-react ^5, @types/* | dev | |

Removed: `three-stdlib`, `lucide-react` (inline SVG icons).

---

## 10. Known limitations

- **Alpha dependencies.** R3F 10 and drei 11 are pinned alphas with lagging types (`Canvas` is cast once in `WebGPUCanvas`).
- **Scene-replacing passes** (SSAA, Pixelation, Retro) re-render the scene and discard effects ordered before them; they default to orders 10–12.
- **Shader compile errors** surface after `build()`, so `PostFX`'s try/catch cannot catch them; the frame goes black until the effect is switched off. Test a new effect first in the chain and behind another effect.
- **No canvas MSAA** — temporal/supersampling passes need single-sample depth; AA comes from FXAA/SMAA/TRAA/TAAU.
- **Studio skin weight** — the studio CSS is 231 kB (41 kB gzip); `skin/base.css`, `components.css`, `dock.css` and `panels.css` still hold rules that match nothing (see the 2026-10-01 entry in §12).
- **Default pixel ratio 1** — the glass scene with post-processing runs 56–60 fps at 1×, 10–16 fps at 1.5×. HUD tiers raise the ceiling.
- **Drei `ContactShadows`/`Grid`** are not WebGPU-safe in these alphas, so both are small canvas-texture versions.
- **Never checked:** microphone/webcam/MIDI permission flows and the WebGL2 fallback (out of scope per the 2026-09-21 decision).

---

## 11. Checklists

### Adding a feature

1. Create `src/features/<area>/<Name>.tsx` (or a folder with one manifest file).
2. Export the component with typed, defaulted props and a doc comment listing what it needs.
3. Import only npm packages, `src/app/*` (never `store` or `registry`), `src/ui/*`, files in its own folder, and `postfx/PostFX.tsx` if it is an effect or needs a pass.
4. Clean up everything it allocates.
5. Export `feature` with a unique `id`, a `kind` and `controls`; export `inspector` if it needs its own studio section.
6. Save. It appears in the scene, its panel, the palette and presets.

### Adding a panel

1. Create `src/panels/<Name>.tsx` with a component and a `panel` manifest.
2. Build it from `app/studio/` blocks and `src/ui` components; keep panel state inside the file.
3. Save. If an older saved layout is active, reset it (studio bar → reset layout).

### Removing anything

Delete the file or folder. `reconcile()` drops its saved state; the dock drops its tab. If the build fails, a boundary rule was broken — fix the importer, not the deletion.

---

## 12. Verification log

**2026-09-21 (phase 6A):**

- `tsc -b` passes.
- Deletion test in §6: seven removals, `tsc --noEmit` and `vite build` pass for each.
- Chrome, WebGPU (dev server on 5191):
  - The default glass scene renders. The Inspector shows the glass diagnostics through the new `inspector` export, and its monitor reports the capture passes running (1 mesh, backdrop 870×652, clean 716×537, RGB mode, 12 taps), so the glass passes now arrive through `usePostFXPass`.
  - The Graph panel's live pipeline lists Scene Pass, depth, normal, velocity, Bloom, Vignette and FXAA. Normal and velocity are only rendered because the panel requests them, so `attachments` and `onStages` both work end to end.
  - The live-graph nodes render their own number fields (10) and switches (12). Typing a Bloom strength in a node updated the stored value (0.6 → 1.1 → back to 0.6).
- Found and fixed during the pass: `GlassInspector` under `features/` imported the store, which made a circular import (`Cannot access 'features' before initialization`) and a blank page. It now gets its state as props (rule 3).

**2026-09-21 (commits `aa4247d`…`5da21d3`):** Graph panel restyled; live graph previews each real pass; glass material, capture passes, controls, inspector and monitoring ported from v1.

**2026-09-17:**

- `tsc` and `vite build` pass (engine chunk 2.9 MB / 859 kB gzip, app 116 kB, vision 258 kB, CSS 45 kB).
- Chrome, WebGPU: default scene 60 fps; all 44 effects switched on one at a time, first and behind Saturation, with no errors; a stacked chain (Glass Rings + Sky + GodRays + GTAO + TRAA + Bloom + Vignette + FXAA) renders; scene features, every Environment/Lighting preset, both projections and every navigation mode toggle cleanly.
- UI with real input: slider drag, keys, typed values, double-click reset, Add-effect menu, ⌘K palette, 375 px width. Dock: all panels open, drag-out floats, "Return to its dock" restores the tab position.
- Bugs fixed then: canvas MSAA vs SSAA/TRAA/TAAU/RecurrentDenoise; Chromatic Aberration centre; SSR metal/roughness buffer; Recurrent Denoise `raw`; God Rays waiting for the shadow map; texture input for God Rays/SSR/MotionBlur when not first; three.js Inspector show/hide and timestamp queries; `onCommit?.(set(x))` skipping `set()`; palette depending on rAF; app root scrolled by focus; Scene cards in one column; MetaBlock pointer capture on inactive pointers.


**Studio bar (2026-09-30):** the dock strip's runtime readout (`app/studio/RuntimeHUD.tsx`) opens one slim bar along the dock that replaces the Telemetry and Appearance panels: health and backend, frame rate and frame time with history and the 60 fps budget, renderer load, the Diagnostics overlays as chips (their settings live in the Inspector), the quality tier, the theme, Advanced, Hide, Presets and the two resets. It is always one row: hairline-divided instruments, each a caps name over one 26px row; on a narrower dock, container-query steps drop secondary readings (geometry and texture counts, then the renderer group, then frame time, labels and overlays) before it falls back to scrolling. Beside a side dock it runs along the free side. Panels no longer carry a toolbar row. Control rows have no inline buttons: right-click a row for reset, copy and paste (`ContextMenu` in `ui/Menu`), and a modified value shows as a teal dot in the margin. The dock's own panel menu is drawn by `app/studio/DockMenu.tsx` through the engine's `renderContextMenu`: placement as small workspace diagrams.

**Cleanup (v0.6, 2026-09-30):** the studio skin (`app/studio/skin/`) went from 26 stylesheets to five — `skin.css` (entry), `tokens.css` (the `--ui-*` tokens, Frost, the two frost themes, state overrides), `base.css` (the earlier rule sets in the `artinos.legacy` / `artinos.instrument` layers), `components.css` (shell and panel layout) and `chrome.css` (the MetaBlock bridge). About 4,800 lines of CSS were removed: every rule whose selector named a class or a `data-*` attribute no code renders (the six material worlds and eight `data-theme` themes were never set; the old `artinos-*` component library is gone). Each step was checked with a computed-style fingerprint of every panel and the studio bar — no visible change. Also removed: `FeatureBoundary`'s unused crash listeners (the console capture already toasts), `PanelEmpty`, unused icons, `.npmrc` (pnpm reads `nodeLinker` from `pnpm-workspace.yaml`).

**Profiler (v0.6, 2026-10-01):** three.js's Inspector overlay (`features/scene/ThreeInspector.tsx`) is gone; its useful half lives in the studio. `app/profiler.ts` subclasses three's headless `RendererInspector` — the renderer calls it around every frame and every render/compute pass — averages each pass's CPU and GPU time by call id, reads `renderer.info.memory`, and publishes a snapshot four times a second. It attaches only while something subscribes, and turns GPU timestamp queries off again when the last reader leaves. The Console panel shows it as two views beside the log: **Performance** (frame rate, CPU, GPU and idle with history; every pass as a tree with CPU, GPU and its share of the frame) and **Memory** (total GPU memory with history; count and size per kind). The studio bar lost its Overlays group; Stats HUD and Signal Monitor are still switched from the Inspector panel.

**Boilerplate cleanup (v0.6, 2026-10-01):** an audit of every area (host, studio and panels, features, UI kit, CSS), then fixes:

- *Repository:* `legacy/v1/` (77 MB), `UI template/` and `artinos-ui-design-specification/` removed (v1 is at `v1.4-final`); `.gitattributes` (LF), `.editorconfig`; `PanelWorkbench.tsx` no longer reads as binary to git (a stray CR); stricter `tsconfig` flags (`noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `erasableSyntaxOnly`); Vite honours `PORT`.
- *Rendering cost:* each feature mounts through `FeatureMount` with its own state, so a slider re-renders one feature (no `JSON.stringify` per tick); the viewport no longer re-renders 4×/s; the dock hands the workspace a cached element per panel; the PostFX, Inspector, InputFlow and Library panels subscribe to primitives; `MetaBlock.focusGroup` is a no-op on an already-focused group and the dock saves its layout once a change settles; console notifications are batched to 10/s; the runtime sampler stops with no readers.
- *GPU:* `disposeChain` walks each node once and frees RTT targets and their quad materials; Graph-panel previews are released (and their target disposed) when the panel closes; GPU graphs recompile only when their shader changes (not on node drags); Lighting, Light (probe), Fog and Environment no longer recreate their light/fog/env map per slider step; MotionBlur, BoxBlur, SSAA, LensFlare, God Rays and Outline update uniforms instead of rebuilding the chain.
- *Correctness:* the `sss` id collision (Subsurface Scattering now `subsurface`); mic/camera/landmarker leaks on fast toggles; IES light props; studio state saved even while a graph drives a control (debounce max-wait, `pagehide` flush); `reveal` clears itself; tab error state no longer leaks between tabs; H no longer fires from a focused Select; a saved dock layout survives a new or closed panel; node-graph shortcuts no longer delete nodes from text fields; the live graph keys objects by uuid and draws attachment wires from what each effect actually read (`PostFXStage.reads`, replacing a hard-coded table with three wrong ids); SSAA no longer crashes the canvas when Recurrent Denoise reads it.
- *Startup:* the two startup images are WebP (5.2 MB → 0.84 MB); Glass Rings no longer preloads its model and Draco at import; drei's WebGL-only legacy entry is a lazy, tree-shaken chunk. Production build: engine 3,118 → 2,985 kB (918 → 870 kB gzip), CSS 241 → 231 kB.
- *CSS:* 220 lines of certain-dead rules removed from `skin/tokens.css`, `skin/chrome.css`, `MetaBlock.css` and `Slider.css` (base/components/dock/panels left for a later pass).
- *Docs:* every feature manifest has a `description`; `docs/ui/theming.md` describes this repository's three themes; README has a start-a-new-project checklist and an asset table.

Checked in Chrome (WebGPU): every effect switched on alone, and every scene/object/overlay feature toggled, with no console or WebGPU validation errors; all eight panels open; viewport and panel clicks write no layout, a tab switch writes it once.

**Library and Inspector (v0.6, 2026-10-01):** the Scene, PostFX and Assets panels merged into the Library, which now browses every component by category — a rail of sections (Objects, Scene, Effects, Input, Overlays) and their shelves (scene groups, effect categories), derived from the manifests in `app/studio/catalogue.tsx` — with a filter, an All / Added / Available switch, Add, Inspect and Remove per tile, and a fold for details and settings before a component is added; Assets and the source kit are two more places on the rail. The Inspector lists only what is active, as one packed card flow in catalogue order with each card captioned by its section; the effect stack keeps its ordinals and reordering, and the pipeline switch sits in the bar. A feature folder's `inspector` section (glass diagnostics, the adaptive room) renders inside its feature's card, so it folds and leaves with the component. `owns` routes palette hits by state: the Inspector claims what is on, the Library the rest; any `studio.reveal` now brings forward the owning panel (`DockShell`), which is how a tile's Inspect works.
