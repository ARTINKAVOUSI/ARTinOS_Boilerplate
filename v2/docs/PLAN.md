# ARTINOS v2 — Rebuild Plan

A full plan for rebuilding the ARTINOS boilerplate (v1.4, the rest of this repository) as a set of copy-pastable React components. It covers the feature contract, the folder layout, how each old package maps to the new files, what is done, and what is left.

Status as of 2026-09-17: **phases 0–5 are built, type-check cleanly, build, and have been checked in the browser** (see [Verification](#10-verification)). Phases 6–9 are not built yet.

---

## 1. Goals

1. **Every capability is one file or one folder.** One PostFX effect, one UI control, fog, the camera, orbit controls, one input device: each is a single unit you can copy into another project, or delete, without editing anything else.
2. **Adding or removing a feature needs no wiring.** A file under `src/features/` that exports a `feature` manifest shows up in the scene and in the studio. Delete the file and it is gone.
3. **The components stay portable.** A feature component takes normal React props. Its only link to this app is a `feature` manifest imported with `import type`, which disappears at build time.
4. **No shared framework.** The old `@artinos/runtime` / `@artinos/r3f` / `@artinos/ui` package layers are gone. Where a small shared piece is really needed (the PostFX host, the signal bus), it is one file and each component that needs it says so.
5. **Same stack and look.** React 19.2, three 0.185.1 (WebGPU + TSL), R3F 10 alpha, drei 11 alpha, and the ARTINOS frosted-glass design language with its six material worlds.

### What changed from v1

| v1 | v2 |
|---|---|
| 7 workspace packages with tier rules and a package doctor | 1 package; folders instead of packages |
| `RuntimeProvider` with 12 registries (parameters, signals, bindings, automation, resources, telemetry, quality, history, logger, modules, frames, presets) | Features take props. The studio store (`src/app/store.ts`) holds values and passes them in. Live values go through a small signal bus. |
| A central `postfx-pipeline.tsx` `switch` over 44 effect types | Each effect file builds its own TSL node and registers it with `<PostFX>` |
| 2-line effect wrappers plus a separate catalog | One file per effect: component, props, docs and studio controls together |
| `*.project.tsx` manifests that list parameters, graphs and bindings | Features discovered from `src/features/**` |
| UI kit that needed the global `theme.css` | Each component folder has its own scoped CSS with fallback values; the theme file is optional |
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
                             └── <Studio>                      src/app/studio    (panels, palette, presets)
```

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

### 2.2 Discovery (`src/app/registry.ts`)

`import.meta.glob('../features/**/*.tsx', { eager: true })`. Only modules that export `feature` are used. Incomplete manifests and duplicate ids are skipped with a console warning. This is the only file that knows the folder name.

### 2.3 State (`src/app/store.ts`)

A plain external store (`useSyncExternalStore`) saved to `localStorage` (`artinos.v2.studio`, versioned):

- `features[id] = { enabled, values, order }`
- `presets[name]` holds snapshots of `features`
- `ui = { visible, world }`
- `reconcile()` drops saved state for features or controls that no longer exist, so deleting a file never breaks a saved session.

Features never read the store. The app passes values in as props, so the store can be replaced without touching any feature.

### 2.4 Render pipeline (`src/features/postfx/PostFX.tsx`)

- Owns one `RenderPipeline` and one scene `pass()`. The MRT attachments (normal, packed normal, velocity, metalness/roughness) are requested only while an active effect needs them. A layout change creates a new pass.
- `usePostFXEffect(id, { order, needs, webgpuOnly, build }, deps)` registers an effect. `build(ctx)` gets `{ input, scenePass, depth, viewZ, normal, velocity, packedNormal, metalRoughness, scene, camera, renderer, backend }` and returns the new image node, or `null` to pass the input through.
- `useUniform(value)` returns a stable TSL uniform whose `.value` follows the prop, so slider drags never recompile the pipeline.
- Each build is wrapped in `try/catch`, so a broken effect is skipped and logged. On the WebGL2 fallback, effects marked `webgpuOnly` are skipped.
- The pipeline is handed to R3F with `set({ postProcessing })`; R3F v10 renders it in its render phase. On each rebuild the intermediate nodes are disposed; the pass and pipeline are disposed on unmount.

### 2.5 Signals (`src/features/input/signals.tsx`)

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
    │   ├── feature.ts  registry.ts  store.ts  Stage.tsx  App.tsx  FeatureBoundary.tsx  app.css
    │   └── studio/     Studio.tsx  ScenePanel.tsx  PostFXPanel.tsx  FeatureSection.tsx
    │                   ControlField.tsx  icons.tsx  studio.css
    ├── ui/                          copy-pastable components: <Name>/<Name>.tsx + <Name>.css
    │   └── theme/theme.css          optional tokens + 6 material worlds
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
| `@artinos/r3f` (ArtinosApp, ProjectRuntime, studio panels) | `app/*`, `app/studio/*` | Shell, Scene and PostFX panels done; other panels in phase 7 |
| `@artinos/modules` (scene, postfx, materials, visual, media, drei/stdlib surfaces) | `features/scene`, `features/postfx/effects`, `features/objects` | Done except the spectral glass material and MediaPlane (phase 6) |
| `@artinos/inputflow` (devices, audio, camera, vision, MIDI, recorder) | `features/input/*` | Pointer, keyboard, audio and hands done; the rest in phase 6 |
| `@artinos/ui` (kernel, headless, primitives, shell, devtools, showcase) | `src/ui/*` | 28 components done; the remainder in phase 8 |
| `@artinos/graph` (node schema, five domain executors, editor) | — | Phase 9 |
| `@artinos/metablock` (spatial docking engine) | — | Phase 8 (optional) |
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

### 5.4 UI kit (28 components done)

`Panel` (glass, collapsible, draggable) · `Field` · `Slider` (capsule: two-ink label, Shift for fine control, double-click reset, type-in, full keyboard) · `NumberField` (scrub) · `VectorField` · `ColorField` (picker + hex + swatches) · `TextField` (search, clear) · `Toggle` · `Checkbox` (indeterminate) · `Select` (native) · `Segmented` · `Tabs` · `Section` · `Button` (4 variants) · `IconButton` · `Toolbar` · `Badge` · `Kbd` · `Meter` (peak hold) · `Sparkline` · `Knob` · `XYPad` · `Tooltip` (portal) · `Menu` (portal, keyboard, checkable) · `Dialog` (native modal) · `CommandPalette` (fuzzy, grouped) · `Toast` (provider + hook, live region) · `FileDrop`.

Still to port from v1, in phase 8: `ColorWheel/ColorArea/GradientEditor`, `CurveEditor/EnvelopeEditor`, `Joystick`, `Waveform`, `RangeSlider`, `Dial`, `RadioGroup`, `Accordion`, `Combobox`, `ContextMenu`, `Drawer`, `Popover`, `VirtualList/VirtualTable/ListBrowser`, `PropertyRow`, `KeyCapture`, `TreeView` (new, for the scene tree), `DockTabs/PanelWorkspace` (docking).

### 5.5 Studio

Done: floating toolbar; Scene panel (search across features and settings, tabs Scene / Input / Diagnostics, groups, per-feature on/off, reset, source path in the tooltip); PostFX panel (bypass for the whole chain, "Add effect" menu by category with cost and WebGPU labels, reorder up/down, cost badges); presets (save, load, delete, export and import JSON, reset); six themes; command palette (views, themes, presets, toggle any feature, copy any feature's path); `H` hides the interface; feature crashes appear as toasts; on narrow screens the panels become a bottom sheet.

---

## 6. Phases

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold: Vite 6, TS 5.8 strict, pnpm hoisted, asset copy, launch config | **Done** |
| 1 | App core: feature contract, discovery, store, boundaries, stage | **Done** |
| 2 | Render: `WebGPUCanvas`, `PostFX` host, 44 effects | **Done** |
| 3 | Scene, objects and overlays (20 features) | **Done** |
| 4 | Input: signal bus, pointer, keyboard, audio, hand tracking | **Done** |
| 5 | UI kit (28) + studio shell | **Done** |
| 6 | Remaining features | To do |
| 7 | Remaining studio panels | To do |
| 8 | Remaining UI kit, and docking (optional) | To do |
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

Each panel becomes an **overlay feature** (`features/panels/*.tsx`), so panels can be added or removed the same way as everything else:

Console (captures `console.*`), Telemetry (renderer info, frame breakdown), Scene Tree + Object Inspector (select → outline → transform gizmo with drei `TransformControls`), Assets (FileDrop → object URLs → Model/Environment/LUT props), History (undo/redo over `store` commits — add a patch log to the store), Bindings (signal → control mapping with a remap curve; the store applies it per frame for bound numeric controls), Quality.

### Phase 8 — remaining UI kit and docking

Port the components listed in 5.4, each with its own folder. Docking (v1 MetaBlock) is optional: a `ui/DockLayout` with split panes and tabs, and panel positions saved in `ui` state.

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
- **Drei `ContactShadows` and `Grid`** are not WebGPU-safe in these alphas, so `ContactShadow` and `Grid` are small canvas-texture versions (as in v1).

## 9. Adding a feature (checklist)

1. Create `src/features/<area>/<Name>.tsx`.
2. Export the component with typed, defaulted props and a doc comment that lists what it needs.
3. Clean up everything it allocates.
4. Export `feature` with a unique `id`, a `kind` and `controls`.
5. Save. It appears in the studio, and nothing else needs changing.

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
- **Not checked:** microphone and webcam permissions (Audio, Hand Tracking), the WebGL2 fallback, and the look of each effect beyond "renders without errors".

### Known gap: shader compile errors

`PostFX` catches errors thrown while an effect *builds* its node. Errors that surface later, when the shader compiles, fail the whole pipeline and the frame goes black until the effect is switched off. The fixes above removed every such case in the shipped effects. A new effect should be tested first in the chain and again behind another effect.
