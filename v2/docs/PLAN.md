# ARTINOS v2 — Rebuild Plan

A full plan for rebuilding the ARTINOS boilerplate (v1.4, the rest of this repository) as a set of copy-pastable React components. It covers the feature contract, the folder layout, how each old package maps to the new files, what is done, and what is left.

Status as of 2026-09-17: **phases 0–5, the MetaBlock dock and nine section panels are built, type-check cleanly, build, and have been checked in the browser** (see [Verification](#10-verification)). The rest of phases 6–9 is not built yet.

---

## 1. Goals

1. **Every capability is one file or one folder.** One PostFX effect, one UI control, fog, the camera, orbit controls, one input device: each is a single unit you can copy into another project, or delete, without editing anything else.
2. **Adding or removing a feature or a panel needs no wiring.** A file under `src/features/` that exports a `feature` manifest shows up in the scene and in the studio. A file under `src/panels/` that exports a `panel` manifest becomes a tab in the dock. Delete the file and it is gone.
3. **The components stay portable.** A feature component takes normal React props. Its only link to this app is a `feature` manifest imported with `import type`, which disappears at build time.
4. **No shared framework.** The old `@artinos/runtime` / `@artinos/r3f` / `@artinos/ui` package layers are gone. Where a small shared piece is really needed (the PostFX host, the signal bus), it is one file and each component that needs it says so.
5. **Same stack, same studio.** React 19.2, three 0.185.1 (WebGPU + TSL), R3F 10 alpha, drei 11 alpha. The studio is the original one: the MetaBlock dock (tabs, drag-out, float, split, merge, return home, maximize, saved layout), the `plate-*` chrome, the embedded performance HUD, the brand chip and the ARTINOS stylesheet with its six material worlds.

### What changed from v1

| v1 | v2 |
|---|---|
| 7 workspace packages with tier rules and a package doctor | 1 package; folders instead of packages |
| `RuntimeProvider` with 12 registries (parameters, signals, bindings, automation, resources, telemetry, quality, history, logger, modules, frames, presets) | Features take props. The studio store (`src/app/store.ts`) holds values and passes them in. Live values go through a small signal bus. |
| A central `postfx-pipeline.tsx` `switch` over 44 effect types | Each effect file builds its own TSL node and registers it with `<PostFX>` |
| 2-line effect wrappers plus a separate catalog | One file per effect: component, props, docs and studio controls together |
| `*.project.tsx` manifests that list parameters, graphs and bindings | Features discovered from `src/features/**` |
| UI kit that needed the global `theme.css` | Each component folder has its own scoped CSS with fallback values; the studio loads the original stylesheet as its skin |
| `@artinos/metablock` package + `MetaBlockShell` with a hard-coded panel list | The same engine as one folder (`src/ui/MetaBlock/`); panels discovered from `src/panels/` |
| Parameter changes rebuilt the whole pipeline | Numeric effect settings are live GPU uniforms (`useUniform`); only structural settings rebuild the chain |

---

## 2. Architecture

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

The canvas is a locked fullscreen MetaBlock group underneath everything. Panels are MetaBlocks inside a persistent dock group, so any tab can be dragged out to float, dropped on another group to merge or split, returned to its exact tab position, or maximized. The whole arrangement is saved (`artinos.v2.dock`) and restored while it still matches the panels on disk.

### 2.1 The feature contract (`src/app/feature.ts`)

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

Control types: `number` → Slider, `boolean` → Toggle, `select` → Select, `color` → ColorField, `vector3` → VectorField, `text` → TextField (applied on Enter or blur).

Mount rules:

- **app**: outside the canvas, mounted *beside* the stage, so turning one on or off never remounts the scene.
- **canvas-provider**: wraps the scene inside the canvas. It stays mounted and receives `enabled`, so switching it off never remounts the scene.
- **scene / effect**: inside the canvas. Effects are rendered only when the `postfx` host exists.
- **overlay**: DOM over the canvas. Also receives `renderer` and `backend`.

Each feature runs inside a `FeatureBoundary` (error boundary + Suspense). If one feature crashes it renders nothing and shows a toast; the rest of the scene keeps running. Changing its props gives it another try.

### 2.2 The panel contract (`src/app/panel.ts`)

```tsx
export const panel: PanelManifest = {
  id: 'scene',                                    // unique; the saved layout is keyed by it
  title: 'Scene',
  description: 'Environment, camera, lighting…',  // tab tooltip + palette
  keywords: ['camera', 'fog'],                    // palette search
  order: 1,                                       // tab order
  dock: 'bottom',                                 // 'bottom' | 'left' | 'right' | 'float'
  active: true,                                   // optional: the tab open on first launch
  footer: () => <>ENVIRONMENT · CAMERA</>,        // optional: pane foot status
  component: Scene,
}
```

`import.meta.glob('../panels/*.tsx', { eager: true })` discovers them. Every panel body is wrapped in `PanelWorkbench` (portrait/landscape container, `--panel-height`, error boundary with Retry). Panels share app-level building blocks from `src/app/studio/` (`FeatureCard`, `ControlsBar`, `ControlInput`), never each other, so deleting one panel file never breaks another.

### 2.3 Discovery (`src/app/registry.ts`)

`import.meta.glob('../features/**/*.tsx', { eager: true })`. Only modules that export `feature` are used. Incomplete manifests and duplicate ids are skipped with a console warning. This is the only file that knows the folder name.

### 2.4 State (`src/app/store.ts`)

A plain external store (`useSyncExternalStore`) saved to `localStorage` (`artinos.v2.studio`, versioned):

- `features[id] = { enabled, values, order }`
- `presets[name]` holds snapshots of `features`
- `ui = { visible, world, favorites, pins }`: favorites and pins are `featureId:control` keys, as in the original inspector
- `reconcile()` drops saved state for features or controls that no longer exist, so deleting a file never breaks a saved session.

Features never read the store. The app passes values in as props, so the store can be replaced without touching any feature.

### 2.5 Render pipeline (`src/features/postfx/PostFX.tsx`)

- Owns one `RenderPipeline` and one scene `pass()`. The MRT attachments (normal, packed normal, velocity, metalness/roughness) are requested only while an active effect needs them. A layout change creates a new pass.
- `usePostFXEffect(id, { order, needs, webgpuOnly, build }, deps)` registers an effect. `build(ctx)` gets `{ input, scenePass, depth, viewZ, normal, velocity, packedNormal, metalRoughness, scene, camera, renderer, backend }` and returns the new image node, or `null` to pass the input through.
- `useUniform(value)` returns a stable TSL uniform whose `.value` follows the prop, so slider drags never recompile the pipeline.
- Each build is wrapped in `try/catch`, so a broken effect is skipped and logged. On the WebGL2 fallback, effects marked `webgpuOnly` are skipped.
- The pipeline is handed to R3F with `set({ postProcessing })`; R3F v10 renders it in its render phase. On each rebuild the intermediate nodes are disposed; the pass and pipeline are disposed on unmount.

### 2.6 Runtime facts and console (`src/app/runtime.ts`, `src/app/console.ts`)

One rAF sampler provides fps, frame-time history and renderer counters (calls, triangles, geometries, textures, resolution, backend) to the dock HUD and the Telemetry panel. `installConsoleCapture()` forwards `console.*` to the Console panel and the warning/error toast.

### 2.7 Signals (`src/features/input/signals.tsx`)

A `SignalBus` (`set`, `get`, `delete(prefix)`, `age`, `entries`). Input features write to it every frame; reactive objects read it inside `useFrame`. Neither causes React renders. There is one default bus, so no provider is needed; `<SignalsProvider>` isolates a subtree when you want that. `useSignalSnapshot(hz)` is for monitors.

---

## 3. Folder layout

```text
v2/
├── index.html · package.json · pnpm-workspace.yaml · tsconfig.json · vite.config.ts
├── public/            backgrounds/ hdr/ models/ draco/ mediapipe/{wasm,models}
├── docs/PLAN.md       this file
└── src/
    ├── main.tsx
    ├── app/                         host only; never edited to add a feature
    │   ├── feature.ts  registry.ts  panel.ts  store.ts  runtime.ts  console.ts
    │   ├── Stage.tsx  App.tsx  FeatureBoundary.tsx  app.css
    │   └── studio/     DockShell.tsx  RuntimeHUD.tsx  ConsoleToast.tsx  PanelWorkbench.tsx
    │                   FeatureCard.tsx  ControlsBar.tsx  ControlField.tsx  layout.ts  icons.tsx  dock.css
    │                   skin/  the original ARTINOS stylesheet (tokens, worlds, themes, legacy,
    │                          instrument, workbench components, plate-* shell, chrome, studio-panels)
    ├── panels/                      one file per dock tab (9)
    │   Inspector  Scene  PostFX  InputFlow  Assets  Library  Console  Telemetry  Appearance
    ├── ui/                          copy-pastable components: <Name>/<Name>.tsx + <Name>.css (29)
    │   ├── MetaBlock/               the docking engine: core/ (framework-free) + react/ + MetaBlock.css
    │   └── theme/theme.css          optional tokens + 6 material worlds for standalone use
    └── features/
        ├── canvas/WebGPUCanvas.tsx
        ├── postfx/PostFX.tsx + effects/*.tsx   (44)
        ├── scene/*.tsx                          (13)
        ├── objects/*.tsx                        (4)
        ├── input/signals.tsx + *.tsx            (4)
        └── overlays/*.tsx                       (3)
```

---

## 4. Rules each unit follows (from the copy-pastable React skill)

1. **Boundary:** one `.tsx` (plus one `.css` where it has styles). Split only when the file would be hard to follow.
2. **No hidden coupling:** relative imports only. No aliases, stores or app services inside components. Settings come in as props.
3. **Styles travel with the component:** every class is prefixed `aui-<name>`. Private variables are declared inside `:where(.aui-x) { --_ink: var(--ui-ink, <fallback>) }`, so the component looks right without `theme.css` and follows a world when the theme is present.
4. **Declared dependencies:** each file's doc comment lists what it needs (three ≥ 0.185, R3F 10, drei 11, MediaPipe, and the local host file where there is one).
5. **Cleanup:** every rAF loop, media stream, AudioContext, texture, geometry, pass and pipeline is released on unmount.
6. **Canvas ownership:** only `WebGPUCanvas` creates a canvas. Every 3D feature mounts inside the canvas you already have.
7. **Renderer order of preference:** TSL on WebGPU, with WebGL2 fallback through `WebGPURenderer`. When neither is available, a message is shown instead of a blank canvas.
8. **Accessibility:** native elements where possible (`<select>`, `<dialog>`, checkbox). Custom controls use ARIA roles and full keyboard support, focus rings are always visible, and motion respects `prefers-reduced-motion`.

### How to copy a unit into another project

| Unit | Copy | Also needs |
|---|---|---|
| UI component | `src/ui/<Name>/` | `react`, `react-dom` (optional: `ui/theme/theme.css`) |
| Docking engine | `src/ui/MetaBlock/` | `react` |
| Studio panel | `src/panels/<Name>.tsx` | this app's `src/app/studio/` building blocks |
| PostFX effect | `features/postfx/PostFX.tsx` + `effects/<Effect>.tsx` | `three`, `@react-three/fiber`; mount `<PostFX>` in your canvas |
| Scene feature | `features/scene/<Name>.tsx` | `three`, R3F; drei for Camera, Controls, Environment, BackdropImage |
| Reactive object | `features/objects/<Name>.tsx` + `features/input/signals.tsx` | as above |
| Input device | `features/input/<Name>.tsx` + `signals.tsx` | MediaPipe for HandTracking |
| Canvas | `features/canvas/WebGPUCanvas.tsx` | `three`, R3F |

Outside this app, delete the `export const feature` block (and its `import type`) or keep it; it has no runtime effect.

---

## 5. Inventory: v1 → v2

### 5.1 Packages

| v1 package | v2 location | Status |
|---|---|---|
| `@artinos/runtime` (registries, canvas, frame bridge, postfx controller, telemetry, quality, inspector) | `features/canvas`, `features/postfx/PostFX.tsx`, `app/store.ts`, `features/input/signals.tsx`, `features/overlays/*` | Core done; bindings, automation, history and adaptive quality are in phases 6–7 |
| `@artinos/r3f` (ArtinosApp, ProjectRuntime, StudioShell, MetaBlockShell, panels) | `app/*`, `app/studio/*`, `src/panels/*` | Dock shell, HUD, console toast and 9 panels done; Graph, Timeline, UI DevTools and the scene tree in phases 7–9 |
| `@artinos/modules` (scene, postfx, materials, visual, media, drei/stdlib surfaces) | `features/scene`, `features/postfx/effects`, `features/objects` | Done except the spectral glass material and MediaPlane (phase 6) |
| `@artinos/inputflow` (devices, audio, camera, vision, MIDI, recorder) | `features/input/*` | Pointer, keyboard, audio and hands done; the rest in phase 6 |
| `@artinos/ui` (kernel, headless, primitives, shell, devtools, showcase) | `src/ui/*` | 28 components done; the remainder in phase 8 |
| `@artinos/graph` (node schema, five domain executors, editor) | — | Phase 9 |
| `@artinos/metablock` (spatial docking engine) | `src/ui/MetaBlock/` | **Done**: ported unchanged apart from two unused variables and safe pointer capture |
| `src/*.project.tsx` (default, persian-garden, ui-platform, voluma) | features + presets | Default scene done; persian-garden and VOLUMA in phase 9 |

### 5.2 PostFX (44 of 44 done)

Each file is `features/postfx/effects/<Name>.tsx`. "Live" means the setting updates without rebuilding the pipeline.

| Category | Effects |
|---|---|
| Light | Bloom (live), WideBloom (live; was `anamorphic`), LensFlare (live except downsample), GodRays (depth-aware blend, finds the shadow-casting light) |
| Lens | DepthOfField (live), ChromaticAberration (live), Vignette (live) |
| Color | Sepia, Grayscale, HueShift, Saturation, BleachBypass, Posterize, Sharpen, ColorGrade (3D LUT: `.cube` URL or a generated built-in grade) — all live |
| Blur | GaussianBlur, BoxBlur, HashBlur, RadialBlur, BilateralBlur |
| Stylize | DotScreen, FilmGrain, RGBShift, SobelEdges, Scanlines, ColorBleeding, Pixelation (scene pass), RetroPS1 (scene pass) |
| Temporal | AfterImage, MotionBlur (velocity), Transition (image + generated noise mask) |
| Screen-space | SSR (blended over the scene), SSGI (GI + AO composite), AmbientOcclusion (GTAO), ScreenSpaceShadows, Denoise, RecurrentDenoise, Outline (`selection` prop or `userData.outline`) |
| Anti-aliasing | FXAA, SMAA, TRAA, TAAU, FSR1, SSAA (scene pass) |

Fixes compared to v1: SSR, SSGI and GTAO are now composited as three.js documents them (v1 replaced the image with the raw effect output). Outline builds its visible and hidden edge colours. LUT and Transition no longer need resources registered somewhere else.

Effects are generated from one spec table so all 44 share the same structure. The generator is not part of the project; to add an effect, copy any effect file.

### 5.3 Scene, objects, input, overlays

| Feature | File | Notes |
|---|---|---|
| Render settings | `scene/RenderSettings.tsx` | tone mapping (7), exposure, shadow filter, max DPR |
| Camera | `scene/Camera.tsx` | 8 framing presets, perspective/orthographic, aims the active controls |
| Navigation | `scene/Controls.tsx` | orbit / map / trackball / camera-controls / none, auto-rotate, limits |
| Environment | `scene/Environment.tsx` | procedural Lightformer presets (no downloads) or an equirect image |
| Background | `scene/Background.tsx` | solid colour, restored on unmount |
| Backdrop image | `scene/BackdropImage.tsx` | camera-locked, cover-fitted photo inside the scene |
| Sky | `scene/Sky.tsx` | three `SkyMesh` (node material, works on WebGPU) |
| Stars | `scene/Stars.tsx` | point shell |
| Fog | `scene/Fog.tsx` | linear / exponential |
| Lighting | `scene/Lighting.tsx` | 8 rigs, Kelvin white balance, shadow-casting key light |
| Ground | `scene/Ground.tsx` | disc/square, matte/glossy/shadow-only |
| Contact shadow | `scene/ContactShadow.tsx` | gradient decal, any backend |
| Grid | `scene/Grid.tsx` | fading texture grid |
| Reactive orb | `objects/ReactiveOrb.tsx` | signal-driven size, spin and glow |
| Signal particles | `objects/SignalParticles.tsx` | point cloud that responds to a signal |
| Glass rings | `objects/GlassRings.tsx` | GLB + physical transmission and dispersion |
| Model | `objects/Model.tsx` | any glTF (Draco), centred and resting on the floor |
| Pointer / Keyboard / Audio / Hands | `input/*.tsx` | `pointer.*`, `key.*`, `keys.axisX/Y`, `audio.level/bass/mid/treble/beat`, `hand.<i>.x/y/pinch/open` |
| Stats HUD | `overlays/StatsHUD.tsx` | fps, frame-time sparkline, draw calls, triangles, geometries, textures, backend |
| Signal monitor | `overlays/SignalMonitor.tsx` | live meters for every signal |
| three.js Inspector | `overlays/ThreeInspector.tsx` | three's official WebGPU inspector, cleanly detached on unmount |

### 5.4 UI kit (29 components + the MetaBlock engine done)

`Panel` (glass, collapsible, draggable) · `Field` · `Slider` (capsule: two-ink label, Shift for fine control, double-click reset, type-in, full keyboard) · `NumberField` (scrub) · `VectorField` · `ColorField` (picker + hex + swatches) · `TextField` (search, clear) · `Toggle` · `Checkbox` (indeterminate) · `Select` (native) · `Segmented` · `Tabs` · `Section` · `Button` (4 variants) · `IconButton` · `Toolbar` · `Badge` · `Kbd` · `Meter` (peak hold) · `Sparkline` · `Knob` · `XYPad` · `Tooltip` (portal) · `Menu` (portal, keyboard, checkable) · `Dialog` (native modal) · `CommandPalette` (fuzzy, grouped) · `Toast` (provider + hook, live region) · `FileDrop` · `PropertyRow` (the inspector row: label, control, reset, hover actions).

Still to port from v1, in phase 8: `ColorWheel/ColorArea/GradientEditor`, `CurveEditor/EnvelopeEditor`, `Joystick`, `Waveform`, `RangeSlider`, `Dial`, `RadioGroup`, `Accordion`, `Combobox`, `ContextMenu`, `Drawer`, `Popover`, `VirtualList/VirtualTable/ListBrowser`, `KeyCapture`, `TreeView` (new, for the scene tree).

### 5.5 Studio (the original dock, rebuilt)

| Piece | File | What it does |
|---|---|---|
| Dock shell | `app/studio/DockShell.tsx` | Port of `MetaBlockShell`: locked viewport, persistent bottom dock, dock toolbar (tabs, search, expand/restore, HUD), floating chrome (tabs, maximize, return to dock, close), footer per panel, saved layout, layout undo/redo in the palette |
| Runtime HUD | `app/studio/RuntimeHUD.tsx` | The original strip readout (backend · fps · micrograph · ms · tier) and its dock-bar popover (fps graph, frame budget, backend, resolution, render, memory, quality tiers that set the pixel-ratio ceiling) |
| Brand chip | in `DockShell` | `ARTINOS / <active panel>` over the canvas |
| Console toast | `app/studio/ConsoleToast.tsx` | Latest warning/error; the count opens the Console panel |
| Node graph | `ui/NodeGraph` | Portable node editor (schema, validation, evaluation) plus the live pipeline view; the studio binds its tokens in dock.css |
| Command palette | `ui/CommandPalette` | The studio’s only search: every panel, feature, control (“Glass Rings › Dispersion” — opens the owning panel and scrolls to the row), source path, layout undo/redo/reset, material worlds, toggle any feature |
| Feature card | `app/studio/FeatureCard.tsx` | The original parameter card: name, count, reset, switch; rows with reset and ⋯ actions (favorite, pin, copy, paste) |

| Panel | File | Contents |
|---|---|---|
| Inspector | `panels/Inspector.tsx` | Project objects as cards in columns; All / Favorites / Pinned and the Presets menu (save, load, delete, export, import, reset), both in the dock strip |
| Scene | `panels/Scene.tsx` | Render, Camera, Atmosphere, Lighting and Ground features as cards, same toolbar |
| PostFX | `panels/PostFX.tsx` | Stack view (active chain in order, reorder, per-effect cards) and Browse view (all 44 by category with cost, WebGPU label, switch, inline controls); pipeline bypass; backend footer |
| InputFlow | `panels/InputFlow.tsx` | Devices (live state, capture switches, settings) and Signals (live values with meters, filter) |
| Assets | `panels/Assets.tsx` | Drop images, glTF and `.cube` files; apply as backdrop, environment, transition target, model or colour grade |
| Library | `panels/Library.tsx` | Every feature, panel and UI component with its path; copy path, switch features |
| Console | `panels/Console.tsx` | Captured log with level filter, message filter, pause, clear, expandable entries |
| Graph | `panels/Graph.tsx` | Live pipeline (inputs → signals → graphs → controls → scene → effect chain → canvas, every node carrying the real switch or slider) and the node editor for authored graphs |
| Telemetry | `panels/Telemetry.tsx` | KPIs, frame-time and fps graphs, load meters; Diagnostics tab with Stats HUD, Signal Monitor and the three.js Inspector |
| Appearance | `panels/Appearance.tsx` | Material world, interface visibility, shortcuts, reset layout / features |

`H` hides the chrome; `Ctrl/⌘ K` opens the palette. Search lives there alone — no panel carries a search field of its own, and a panel’s toolbar (filter, presets, view) rides in the dock strip through `PanelBar`, so it costs the panel no row. Each panel claims the features it shows with `owns` in its manifest, which is how a palette hit knows where to go. The default scene matches the original UI-platform project: Persian garden backdrop and environment, glass rings, Bloom + Vignette + FXAA.

---

## 6. Phases

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold: Vite 6, TS 5.8 strict, pnpm hoisted, asset copy, launch config | **Done** |
| 1 | App core: feature contract, discovery, store, boundaries, stage | **Done** |
| 2 | Render: `WebGPUCanvas`, `PostFX` host, 44 effects | **Done** |
| 3 | Scene, objects and overlays (20 features) | **Done** |
| 4 | Input: signal bus, pointer, keyboard, audio, hand tracking | **Done** |
| 5 | UI kit (29) + studio shell | **Done** |
| 5b | MetaBlock dock, original skin, HUD, 9 section panels | **Done** |
| 6 | Remaining features | To do |
| 7 | Remaining studio panels (Scene tree, History, Bindings, UI DevTools) | To do |
| 8 | Remaining UI kit | To do |
| 9 | Graph, timeline and example scenes | To do |

### Phase 6 — remaining features

- `objects/GlassMaterial` — port v1's spectral transmission material (`transmission-nodes.ts`, `TransmissionPhysicalLightingModel`, backdrop/clean passes). Needs a *pass provider* API on `PostFX` so a material can ask for an extra backdrop pass (`usePostFXPass('backdrop', …)`).
- `objects/MediaPlane` — webcam or video texture plane. Share the camera stream with `HandTracking` through the signal bus's resource slot (add `bus.setResource/getResource`).
- `objects/Water` (three `WaterMesh`) and `objects/Reflector`, for the persian-garden scene.
- `input/Gamepad`, `input/Midi`, `input/Orientation`, `input/AudioFile` (source option), `input/CameraMotion` (frame-difference motion and colour).
- `input/SignalRecorder` — record and replay the bus to JSON.
- `scene/AdaptiveQuality` — watch frame time and step DPR and the shadow map size.
- `scene/Light` — a single configurable light (spot, point, rect-area, IES, probe) for custom rigs.

### Phase 7 — remaining studio panels

Each is one file in `src/panels/` (the dock picks it up):

- **Scene Tree + Object Inspector**: select → outline → transform gizmo with drei `TransformControls`.
- **History**: undo/redo over store commits (add a patch log to the store).
- **Bindings**: signal → control mapping with a remap curve; the store applies it each frame for bound numeric controls.
- **UI DevTools**: component anatomy, state and token inspector.
- **Graph** and **Timeline**: see phase 9.

### Phase 8 — remaining UI kit

Port the components listed in 5.4, each with its own folder.

### Phase 9 — graph, timeline, examples

- `features/graph/` — a node graph as one folder: `schema.ts` (typed ports), `evaluate.ts` (signal/parameter domains first), `GraphEditor.tsx` (canvas editor built on ui components). It drives the same bindings mechanism as phase 7.
- `features/timeline/` — keyframe tracks over numeric controls, with play/loop.
- Example scenes as **presets plus optional object features**: `presets/persian-garden.json` (Environment image, Water, Orb, Bloom, Vignette) and VOLUMA as its own folder `features/voluma/` (fluid solver + volume renderer + audio routing). Being a single folder, it can be deleted like any other feature.

---

## 7. Dependencies

| Package | Version | Used by |
|---|---|---|
| react / react-dom | 19.2.0 | everything |
| three | 0.185.1 | canvas, postfx, scene, objects |
| @react-three/fiber | 10.0.0-alpha.2 | canvas and every 3D feature (async `renderer` factory, `state.postProcessing`) |
| @react-three/drei | 11.0.0-alpha.5 | Camera, Controls, Environment/Lightformer, BackdropImage (`useTexture`), GlassRings/Model (`useGLTF`, `Center`), ReactiveOrb (`Float`) |
| @mediapipe/tasks-vision | 0.10.35 | HandTracking (loaded only when turned on; own chunk) |
| typescript ~5.8, vite ^6, @vitejs/plugin-react ^5, @types/* | dev | |

Removed: `three-stdlib` (no longer imported), `lucide-react` (the UI kit uses inline SVG).

Public assets: `hdr/persianbeauty.png`, `backgrounds/persian-garden.png`, `models/glass-rings.glb`, `draco/*`, `mediapipe/wasm/*`, `mediapipe/models/hand_landmarker.task`. The other MediaPipe models (face, pose, gesture, object) stay in v1 until phase 6 needs them.

---

## 8. Known limitations

- **Alpha dependencies.** R3F 10 and drei 11 are pinned alphas, and their types lag behind (`Canvas` is cast once, in `WebGPUCanvas`). Upgrading means re-checking the async `renderer` factory and `state.postProcessing`.
- **HashBlur `repeats`.** The option exists in three's JS but not in `@types/three` 0.185, so it is cast.
- **Scene-replacing passes** (SSAA, Pixelation, Retro) re-render the scene and discard effects ordered before them. They default to orders 10–12, and the panel footer explains this.
- **Transmission and PostFX.** The simple `GlassRings` material uses three's built-in transmission. The v1 spectral backdrop pipeline is phase 6.
- **No canvas MSAA.** Temporal and supersampling passes need single-sample depth, so anti-aliasing comes from FXAA, SMAA, TRAA or TAAU.
- **Studio skin weight.** The original stylesheet is carried over whole (about 330 kB, 52 kB gzip) so the studio matches v1 exactly. Its legacy layers can be pruned later.
- **Default pixel ratio 1.** On a 1.5× display, the glass scene with post-processing ran at 10–16 fps at full resolution and 56–60 fps at 1×. The HUD's quality tiers raise the ceiling.
- **Drei `ContactShadows` and `Grid`** are not WebGPU-safe in these alphas, so `ContactShadow` and `Grid` are small canvas-texture versions (as in v1).

## 9. Adding a feature (checklist)

1. Create `src/features/<area>/<Name>.tsx`.
2. Export the component with typed, defaulted props and a doc comment that lists what it needs.
3. Clean up everything it allocates.
4. Export `feature` with a unique `id`, a `kind` and `controls`.
5. Save. It appears in the studio, and nothing else needs changing.

### Adding a panel

1. Create `src/panels/<Name>.tsx` with a component and a `panel` manifest.
2. Build it from `FeatureCard`, `ControlsBar` and the `src/ui` components; keep panel-specific state inside the file.
3. Save. It appears as a dock tab and in the palette. If an older saved layout is active, reset the dock layout (Appearance panel).

## 10. Verification

What ran for this rebuild:

- `tsc` (strict, `noUnusedLocals`, `verbatimModuleSyntax`): **passes with no errors**.
- `vite build`: **succeeds** (engine chunk 2.9 MB / 859 kB gzip, app 116 kB, vision 258 kB, CSS 45 kB).
- **In the browser (Chrome, WebGPU backend):**
  - The default scene renders at 60 fps.
  - **All 44 effects** were switched on one at a time, both first in the chain and behind a non-texture effect (Saturation at order 1). None logged errors. The only message is Retro's harmless "no uv" warning for point clouds.
  - A stacked chain rendered without errors: Glass Rings + Sky + sun lighting + God Rays + GTAO + TRAA + Bloom + Vignette + FXAA.
  - Scene features toggled without errors: Sky, Stars, Grid, Backdrop, Fog, Glass Rings, Model, Signal Monitor and the three.js Inspector; so did every Environment and Lighting preset, both camera projections and every navigation mode.
  - UI checked with real input: slider drag, arrow/Home/End keys, typing a value, double-click reset; Add-effect menu; Ctrl+K palette; phone width (375 px), where the bottom sheet shows and nothing scrolls sideways.
- **Bugs found and fixed during that pass:**
  - Canvas MSAA broke SSAA, TRAA, TAAU and Recurrent Denoise, so the canvas now runs without MSAA and the pipeline does the anti-aliasing.
  - Chromatic Aberration needed an explicit centre.
  - SSR needed a metalness/roughness buffer (new `metalRoughness` attachment).
  - Recurrent Denoise needs its `raw` input.
  - God Rays has to wait for the light's shadow map.
  - God Rays, SSR and Motion Blur need a texture input when they are not first in the chain.
  - The three.js Inspector used the wrong show/hide API and left timestamp queries running after removal.
  - `onCommit?.(set(x))` skipped `set()` when no `onCommit` was passed (Slider, Knob, NumberField, XYPad).
  - The command palette depended on `requestAnimationFrame`.
- **Dock and panels (browser, WebGPU):**
  - All nine panels open with no errors or crashed panels.
  - A tab dragged out becomes a floating window; "Return to its dock" puts it back at its original tab position.
  - The brand chip follows the active panel. PostFX Browse and Stack views both work.
  - The default glass scene runs at 60 fps at pixel ratio 1.
  - Fixed in this pass: the app root could be scrolled by focus (now `overflow: clip`); Scene cards stacked in one column (group headings replaced by card captions); MetaBlock threw on pointer capture/release for inactive pointers (now guarded).
- **Not checked:** microphone and webcam permissions (Audio, Hand Tracking), the WebGL2 fallback, and the look of each effect beyond "renders without errors".

### Known gap: shader compile errors

`PostFX` catches errors thrown while an effect *builds* its node. Errors that surface later, when the shader compiles, fail the whole pipeline and the frame goes black until the effect is switched off. The fixes above removed every such case in the shipped effects. A new effect should be tested first in the chain and again behind another effect.
