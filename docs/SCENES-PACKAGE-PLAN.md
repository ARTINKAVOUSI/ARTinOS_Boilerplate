# `@artinos/scenes` — Package Plan

Status: **phases 0–4 implemented** on `feat/scenes-package` · Source: `packages/adaptive-open-front-3d-room (fable stable).zip`

## Implementation status (2026-09-16)

Done:
- **Phase 0:** API spike. R3F v10 runs `useFrame` priorities highest-first (v9 ran lowest-first), and `{ phase }` options are v10-only, so the package targets v10 (D2). `PostProcessing` is deprecated in favour of `RenderPipeline`.
- **Phase 1:** package, core and model, plus 15 model tests and 2 boundary tests.
- **Phase 2:** R3F layer, `AdaptiveRoomScene`, `SceneCanvas`, `ScenePostFX`, controller and shortcuts.
- **Phase 3:** `ArtinosProject.stage` opt-out, and the SSGI blend and parameters in the runtime pipeline.
- **Phase 4:** `@artinos/scenes/artinos` kit, `src/adaptive-room.project.tsx` and 7 adapter tests. Verified in the studio on WebGPU.

Where the build differs from the plan:
- Presets stay in one file, and `lighting.ts` holds modes, schemes and Kelvin helpers together.
- The room's per-frame work runs in one `start`-phase job inside `AdaptiveRoom` rather than in separate layout, camera and subject components. v10's reversed priorities made cross-component ordering fragile.
- The recipe/controller is room-specific (`useAdaptiveRoomController`) rather than a generic `useSceneController`.
- Plan item 4.2 changed: the kit does not register its own PostFX effects. It enables the host's `postfx.ssgi` and `postfx.traa` parameters (one writer per value). Room exposure and SSGI strength map to `render.exposure` and `postfx.ssgi.*`.
- A new `scene.room.themeSurface` flag lets theme switches keep driving plaster colour and roughness without a second writer.

Bugs found and fixed along the way:
- SSGI and GTAO AO textures are single-channel, so blending with the vec4 tinted the image red. Fixed in the zip pipeline and the runtime pipeline.
- `RectAreaLightNode.setLTC` was missing.
- Swapped geometries and plaster maps leaked; fog and background were not restored on unmount.
- `scripts/doctor.mjs` crashed on non-directory entries in `packages/`.

Performance and parity with the zip (2026-09-16, NVIDIA Turing, 2713×1543 at DPR 1.25). The room keeps the zip's exact quality table: 1×8, 2×8, 3×12 and 4×16 SSGI slices × steps, all at full resolution.
- **Reference:** the original zip app, run from its own lockfile (three 0.186, R3F 9), gets 11–15 FPS at `balanced` with the ball pool at this size.
- **ARTINOS room:** the same settings now run at 12.5 FPS, which is parity.
- **Boilerplate bugs found and fixed while getting there:**
  - The Three Inspector drives frames with `setAnimationLoop(advance)`, but R3F v10's scheduler kept its own loop. Every frame ran twice (update, render and SSGI) and the second run saw `delta = 0`. The inspector now stops the scheduler loop while it drives frames.
  - Scene-pass attachments were chosen from all *registered* effects, disabled ones included. Every project rendered full-resolution normal, packed-normal and velocity targets. With SSGI added, that exceeded WebGPU's 32 bytes/sample limit. `resolveSceneAttachments` now counts enabled effects only, and SSGI reads the 8-bit packed normal as the zip does.
  - Adaptive quality judged single frames. V-sync alternates 17/33 ms, so it never stepped down. It now uses 0.5 s windows (1 s to step down, 5 s to step up), with hysteresis, and tops out at `high`.
  - Scalar-only quality changes no longer rebuild the effect graph.
- **Standalone check:** `/packages/scenes/examples/standalone.html` runs the package's copy of the zip pipeline without ARTINOS.

Open:
- Phase 5 (panel on `@artinos/ui`) and phase 6 (hardening).
- Inert stage controls still appear in the Scene panel when a project turns those stage sections off.
- Scaling BallSim population with the quality tier.
- Registering plaster maps as runtime resources.
- Screenshot parity against the zip.

`@artinos/scenes` is a library of **preset, fully configured, ready-to-use 3D scenes**. You drop in a
scene, pass your content as children, and get architecture, camera, lighting, staging, themes,
presets and post-processing that already work together.

The package must be **independent**: it runs in any React + R3F + three/webgpu app with no ARTINOS
dependency. The boilerplate consumes it through a thin ARTINOS adapter, so the templates get the
scene from `packages/` and not from copied files.

The first scene is the **Adaptive Open-Front Room**, a chamber that resizes itself to fit the camera
frustum. More scenes will follow on the same contract.

---

## 1. Source analysis

### 1.1 What the zip contains

A standalone Vite + Tailwind demo app (`react-vite-tailwind`), ~9,000 lines excluding the lockfile.

| Area | Files | Lines | Nature |
|---|---|---:|---|
| Scene core | `room/AdaptiveRoom.tsx`, `roomGeometry.ts`, `params.ts`, `textures.ts` | ~1,080 | Frustum-fitted shell, damped camera rig, subject fitting, bounds publishing |
| Lighting | `room/lighting.ts`, `LightingRig.tsx` | ~1,290 | 8-channel studio rig (key/fill/rim/top/softbox/accent/ring/ambient), 8 light modes, colour schemes, Kelvin, gels, mute/solo |
| Staging | `room/StagingRig.tsx` | 162 | Plinth, turntable, shadow catcher, backdrop card, floor sheen |
| Spaces | `room/spaces.tsx` | 636 | 9 architectural shells (cyclo, niche, lightbox, monolith, tiers, slice, runway, pavilion, atmos) that follow the live bounds |
| Content | `room/environments.tsx`, `BallSim.tsx`, `PendulumWave.tsx`, `Kinetic.tsx` | ~750 | 7 content "environments": void, sculpture, stage, wave, kinetic, pool, drift. `fitted` or `free` mode |
| Look data | `room/themes.ts`, `room/presets.ts`, `room/quality.ts` | ~1,330 | 18 themes, 7 preset collections (~60 presets), 4 quality tiers |
| Render | `room/PostFX.tsx`, `BoundsHelper.tsx` | ~250 | Progressive pipeline: SSGI+TRAA → GTAO+FXAA → FXAA → plain |
| App shell | `App.tsx`, `store.ts` | ~840 | State orchestration, preset/theme CRUD, localStorage, URL hash, autoplay, keyboard shortcuts |
| UI | `components/**` | ~2,300 | Tailwind panel (Tune/Light/Spaces/Themes/Presets tabs) + dock |

### 1.2 Architecture as built

```
viewport → aspect → fitFrustum() → room dims (damped) → RoomShellGeometry.update()
                                        │
                                        ├→ environment.bounds (module singleton + window.environment)
                                        │     └→ spaces / BallSim / PendulumWave / Kinetic read it every frame
                                        ├→ camera rig (level view, fov/dist damping, pointer parallax)
                                        └→ subject fit (measure children → uniform scale into safe area)
```

The design is sound. **Orthogonal axes** make up a *recipe*:
`content (env) × space × theme × params × light × staging × sim × quality`. A preset is a
partial override of that recipe. This is exactly the "preset scene" model the package needs.

### 1.3 Compatibility with the boilerplate

| Topic | Zip | Boilerplate | Impact |
|---|---|---|---|
| Renderer | `three/webgpu` + TSL | `three/webgpu` + TSL | ✅ Same family |
| three | `^0.186.0` | `0.185.1` pinned | ⚠ APIs used were checked in 0.185.1: `PostProcessing`, `SSGINode` (`sliceCount`, `stepCount`, `giIntensity`, `aoIntensity`, `getGINode`, `getAONode`), `RectAreaLightNode.setLTC` all exist. Still needs a runtime smoke test. |
| R3F | `^9.7.0` | `10.0.0-alpha.2` | ⚠ `<Canvas gl={async…}>` becomes `renderer={…}`. Numeric `useFrame` priority still works in v10, but whether priority > 0 still turns off auto-render is **unverified** (the room's PostFX depends on it). |
| React | 19.2.6 | 19.2.0 | ✅ |
| Styling | Tailwind 4, `clsx`, `tailwind-merge` | `@artinos/ui` tokens; no Tailwind; `@artinos/ui` may only depend on react/react-dom/lucide | ❌ The panel UI cannot be moved over. It has to be rebuilt or left as a standalone example. |
| Render ownership | `PostFX` takes over the frame at priority 1 | One `RenderPipelineSystem` driven by `PostFXController` | ❌ Two pipelines would conflict. Inside ARTINOS the room must request effects instead of rendering. |
| Stage ownership | Room owns camera, lights, background, exposure, DPR | `RuntimeStage` always mounts Environment, Camera, Controls, Lighting, Shadows, Fog, Grid, RenderSettings | ❌ They would fight over the camera and the lights. The stage needs a way to opt out. |
| SSGI | `beauty·AO + diffuse·GI` composite using a `diffuseColor` MRT, tuned per quality tier | `case 'ssgi': current = ssgi(current, depth, normal, camera)`: raw SSGI output replaces the colour, no params, no diffuse MRT | ❌ The boilerplate SSGI can't reproduce the room's look, and it looks wrong for every project. Fix it in `@artinos/runtime`. |
| Quality | `low/balanced/high/ultra` → DPR + SSGI slices/steps | `QualityTier` uses the same four names; `RenderSettings` is the only DPR consumer | ✅ Map it through `runtime.quality.register`; the room must not call `setDpr` in ARTINOS. |
| Tone mapping | ACES + damped exposure | `RenderSettings` owns tone mapping and exposure | ⚠ One owner per value: map room exposure to `render.exposure`. |
| Persistence | `localStorage` keys + URL hash | Runtime persistence + `PresetRegistry` | ⚠ Needs a storage adapter. |
| Shortcuts | digits, `[ ]`, `q/e`, space, `b`, `h` on `window` | Studio shortcuts (Ctrl/Cmd+K, arrows, …) | ⚠ Make them opt-in in the package; register them as runtime commands in ARTINOS. |
| Existing overlap | — | `@artinos/modules` already has an `adaptive-room` environment preset: a Drei `Backdrop` scaled from content bounds | ⚠ Name collision; see decision D6. |

### 1.4 Defects and portability hazards found in the source

1. **Global singleton bounds.** `environment.bounds` is module state and is also written to `window.environment`. Two rooms on one page, or two canvases, would corrupt each other. → Use a per-instance bounds channel through context.
2. **RectAreaLight on WebGPU.** `LightingRig` calls `RectAreaLightTexturesLib.init()` but never `RectAreaLightNode.setLTC(...)`. On `WebGPURenderer`, rect-area softboxes are then likely unlit or silently fall back. → Fix, and verify visually.
3. **Hidden render takeover.** `PostFX` renders manually and calls `state.gl.render` as its fallback. That is only valid when the component owns the frame.
4. **Canvas-only textures.** `getPlasterMaps()` is a module-level lazy cache, never disposed. Fine standalone, but it leaks across ARTINOS project switches. → Reference-count it, or register it as a runtime resource.
5. **`subjectKey` coupling.** Subject re-measuring is keyed on `envId`. Arbitrary host content needs an explicit `fitKey` and/or a `ResizeObserver`-style bounds poll.
6. **App-level state explosion.** `App.tsx` holds 15 `useState`s plus a `live` ref mirror. → Move to a headless controller that the standalone UI and the ARTINOS adapter both use.
7. **`far`/`near` rewrite.** The camera rig rewrites `near`/`far` every frame it changes. Other camera consumers (ARTINOS Camera, controls) must be off while the room owns the camera.
8. **StrictMode.** `PostFX` builds after two rAFs and disposes on cleanup. That is StrictMode-safe, but it must be re-checked once the effect is split.

---

## 2. Goals and non-goals

**Goals**

- G1 · One install, one component: `<AdaptiveRoomScene preset="atelier">{content}</AdaptiveRoomScene>` gives a finished scene.
- G2 · Independent: core works with only `react`, `three` and `@react-three/fiber` (peer deps). No Tailwind, no ARTINOS, no globals.
- G3 · Data-first: every scene has a typed state, defaults, a parameter **schema** (label/min/max/step/group), themes and presets. Any UI (ARTINOS Inspector, a custom panel, leva, …) can generate controls from it.
- G4 · First-class ARTINOS integration: parameters, presets, PostFX, quality, bounds signals and commands, with no duplicate render or stage ownership.
- G5 · Reusable scene contract, so later scenes (gallery, void studio, product turntable, …) plug in the same way.
- G6 · The visual result matches the zip's "fable stable" look for the same preset.

**Non-goals (v1)**

- Moving the Tailwind panel into `@artinos/ui` unchanged.
- WebGL (non-`three/webgpu`) renderer support. `WebGPURenderer`'s WebGL2 backend fallback **is** in scope.
- A physics engine. `BallSim` stays a bounded, self-contained integrator.
- Publishing to npm (the package stays `private`, but is shaped so it could be published).

---

## 3. Package design

### 3.1 Identity

| | |
|---|---|
| Folder | `packages/scenes` |
| Name | `@artinos/scenes` |
| Entry points | `.` (core + R3F scenes), `./adaptive-room`, `./artinos` (adapter), `./ui` (phase 5) |
| peerDependencies | `react 19.x`, `three >=0.185 <0.190`, `@react-three/fiber ^9 \|\| ^10.0.0-alpha` |
| optional peer | `@artinos/runtime` (only for `./artinos`), `@artinos/ui` (only for `./ui`) |
| Tier | `scenes → (nothing)`; `scenes/artinos → runtime`; `scenes/ui → ui, runtime` |

### 3.2 Folder layout

This follows the repo's one-concept-per-file style: a pure core, small orchestrating components, and
thin adapters.

```text
packages/scenes/
  package.json · tsconfig.json · README.md
  src/
    index.ts                         public API barrel (no ARTINOS imports)

    core/                            framework-agnostic, no React
      scene-definition.ts            SceneDefinition<S>, defineScene()
      param-schema.ts                ParamDescriptor, ParamSchema<S>, validate/coerce (replaces safeMergeParams)
      recipe.ts                      resolveRecipe(defaults, theme, space, preset) — layered merge
      registry.ts                    SceneRegistry (register/list/get)
      bounds.ts                      SceneBounds type + createBoundsChannel() (subscribe/get/set)
      damp.ts                        critically-damped helpers
      storage.ts                     StorageAdapter + memoryStorage() + localStorageAdapter(prefix)
      bundle.ts                      export/import bundle + shape guards (from store.ts)
      ids.ts                         uid()

    react/                           shared R3F plumbing for every scene
      SceneBoundsProvider.tsx        context carrying the bounds channel
      useSceneBounds.ts              read live bounds (ref) / subscribe (state)
      SceneBackground.tsx            damped background colour
      ExposureController.tsx         damped exposure (standalone only)
      BoundsHelper.tsx
      SceneCanvas.tsx                standalone WebGPU canvas (renderer factory, shadows, tone mapping)
      ScenePostFX.tsx                standalone progressive pipeline (from PostFX.tsx)
      useSceneController.ts          generic headless controller: recipe state, presets, themes, dirty flag, autoplay
      useSceneShortcuts.ts           opt-in keyboard map

    adaptive-room/
      index.ts                       public barrel for the scene
      definition.ts                  defineScene({ id:'adaptive-room', … })

      model/                         pure data + math (unit-tested)
        room-params.ts               RoomParams + DEFAULT_ROOM
        frustum.ts                   fitFrustum, FRONT_PAD, MAX_COVER
        subject-fit.ts               computeSubjectScale (pure extraction of step 6)
        light-params.ts              LightParams, LightChannelId, LIGHT_CHANNELS, DEFAULT_LIGHT
        light-modes.ts               LIGHT_MODES, applyLightMode
        color-schemes.ts             COLOR_SCHEMES, applyColorScheme
        light-math.ts                kelvinToHex, channelGain, channelColor, gel helpers
        staging-params.ts            StagingParams, DEFAULT_STAGING
        sim-params.ts                SimOpts, DEFAULT_SIM
        quality.ts                   QUALITIES, getQuality
        themes.ts                    Theme, THEMES
        state.ts                     AdaptiveRoomState (= full recipe) + defaults
        schema.ts                    ParamSchema for every state field (groups, ranges, advanced flags)
        presets/
          index.ts                   COLLECTIONS, ALL_BUILTIN
          signature.ts · kinetic.ts · playful.ts · architecture.ts
          photography.ts · studio-sets.ts · lighting.ts

      geometry/
        RoomShellGeometry.ts         unchanged topology, fixed-buffer rewrite
        plaster-maps.ts              ref-counted acquire/release
        shapes.ts                    roundedRectShape, makeFrameGeometry, makePuck

      components/
        AdaptiveRoom.tsx             shell mesh + material only (receives dims ref)
        RoomLayout.tsx               per-frame fit: dims damping + bounds publish (priority -1)
        RoomCameraRig.tsx            level camera, fov/dist damping, parallax (can be turned off)
        SubjectFit.tsx               measure + fit children; fitKey prop
        LightingRig.tsx              + RectAreaLightNode.setLTC fix
        StagingRig.tsx
        spaces/                      one file per space + registry (SPACES, getSpace)
        contents/                    Sculpture, FloatingStage, PendulumWave, Kinetic, BallSim + registry (CONTENTS)

      AdaptiveRoomScene.tsx          batteries-included composition (see 3.4)

    artinos/                         subpath "@artinos/scenes/artinos"
      index.ts
      schema-to-parameters.ts        ParamSchema → ParameterDefinition[] (generic, all scenes)
      presets-to-runtime.ts          scene presets/themes → runtime Preset transactions
      useRuntimeSceneState.ts        resolve parameters → scene state (one subscription per group)
      publish-bounds.ts              bounds → runtime.signals ('scene.bounds.*') + resource
      scene-postfx.ts                scene PostFX request → usePostFX registrations
      scene-quality.ts               runtime.quality → scene quality consumer
      adaptive-room/
        ArtinosAdaptiveRoom.tsx      runtime-driven <AdaptiveRoomScene externalRender>
        project-kit.ts               adaptiveRoomKit(options) → { parameters, presets, stage, commands, Content wrapper }

    ui/                              phase 5, subpath "@artinos/scenes/ui"
      ScenePresetBrowser.tsx · ThemeGrid.tsx · SpacePicker.tsx · LightChannelMixer.tsx
```

### 3.3 The scene contract (shared by all future scenes)

```ts
export interface SceneDefinition<S extends object> {
  id: string                      // 'adaptive-room'
  label: string
  description: string
  version: string
  defaults: S                     // complete state
  schema: ParamSchema<S>          // drives every generated UI and the ARTINOS parameters
  themes?: SceneTheme<S>[]        // partial state layered under the preset
  variants?: Record<string, SceneVariant<S>[]>   // e.g. spaces, contents
  presets: ScenePresetCollection<S>[]
  capabilities: {
    bounds?: boolean              // publishes SceneBounds
    subjectFit?: boolean          // children are fitted into a safe area
    ownsCamera?: boolean
    ownsLights?: boolean
    postfx?: ScenePostFXRequest[] // e.g. [{ type:'ssgi', minTier:'balanced' }, { type:'traa' }]
    requires?: ('webgpu' | 'shadows' | 'mrt-velocity')[]
  }
}
```

Recipe resolution is always the same layered merge:
`defaults ← theme ← variant overrides (space) ← preset.params ← user edits`.
This replaces the hand-written merges in `applyPreset`, `applyThemeObj` and `resetToTheme`.

### 3.4 Public API (adaptive room)

```tsx
// Fully standalone: canvas, renderer, postfx and all
<SceneCanvas>
  <AdaptiveRoomScene preset="golden-hall" />
</SceneCanvas>

// Your own content, fitted into the safe area
<AdaptiveRoomScene preset="atelier" fitKey={model.uuid}>
  <primitive object={model} />
</AdaptiveRoomScene>

// Controlled: you own the state (e.g. from your own store or UI)
const room = useAdaptiveRoomController({ storage: localStorageAdapter('my-app') })
<AdaptiveRoomScene state={room.state} onBoundsChange={room.setBounds} />
room.applyPreset('noir-orbit'); room.applyTheme('sage'); room.applySpace('runway')

// Composable: use only the parts you need
<SceneBoundsProvider>
  <RoomLayout params={p} />
  <AdaptiveRoom params={p} />
  <RoomCameraRig params={p} parallax={false} />
  <LightingRig light={l} />
  <BallSim mode="pool" palette={theme.palette} />   {/* reads bounds from context */}
</SceneBoundsProvider>
```

`AdaptiveRoomScene` props (summary):

| Prop | Default | Purpose |
|---|---|---|
| `preset` / `state` / `defaultState` | `'atelier'` | uncontrolled preset id, controlled state, or initial state |
| `content` | preset's content | built-in content id (`'sculpture'`, `'pool'`, …) or `null` |
| `children`, `fitKey` | — | host subject + re-measure key |
| `free` | — | host content that reads bounds itself |
| `camera` | `true` | `false` hands the camera to the host |
| `lights` | `true` | `false` hides the rig (e.g. when the host supplies lights) |
| `background` / `exposure` | `true` | the scene manages background colour and exposure |
| `postfx` | `'auto'` | `'auto'` (standalone pipeline), `'external'` (emit a request only), `false` |
| `quality` | `'balanced'` | tier id |
| `onBoundsChange` | — | throttled bounds callback |
| `exposeGlobalBounds` | `false` | legacy `window.environment` for external simulations |

---

## 4. ARTINOS integration

### 4.1 Required boilerplate changes (outside the package)

1. **`@artinos/r3f` stage opt-out.** Add to `ArtinosProject`:
   ```ts
   stage?: false | { environment?: boolean; camera?: boolean; controls?: boolean; lighting?: boolean;
                     shadows?: boolean; fog?: boolean; grid?: boolean; render?: boolean }
   ```
   `RuntimeStage` skips the disabled sections. `RenderSettings` (tone mapping, DPR, shadow map type) **stays on**, because it is the single DPR/tone-mapping owner. The room does not replace it.
2. **`@artinos/runtime` SSGI composite.** Replace the `ssgi` case with the room's composite: add `diffuseColor` to the MRT when SSGI is active, output `beauty·AO + diffuse·GI`, and expose params (`giIntensity`, `aoIntensity`, `radius`, `thickness`, `slices`, `steps`, `temporal`) in `postFXCatalog`. Tie `slices/steps` to the quality tier. Add a regression test in `tests/render-pipeline.test.mjs`.
3. **Package boundary.** Add the `scenes` tier to `docs/PACKAGES.md`, root `package.json` (`"@artinos/scenes": "file:packages/scenes"`), `tsconfig` references, and a `tests/scenes-boundary.test.mjs` modelled on `ui-boundary.test.mjs`:
   - `src/**` except `artinos/` and `ui/` may import only `react`, `three`, `three/*`, `@react-three/fiber` and its own files.
   - `src/artinos/**` may additionally import `@artinos/runtime`.
   - `src/ui/**` may additionally import `@artinos/ui` and `@artinos/runtime`.
4. **Catalog.** Do not add the scene to `@artinos/modules/catalog.ts`, because modules may not depend on scenes. The ARTINOS adapter registers its own `ModuleManifest` through `project.modules` instead.

### 4.2 Adapter behaviour (`@artinos/scenes/artinos`)

| Concern | Mechanism |
|---|---|
| Parameters | `schemaToParameters(adaptiveRoom.schema, { prefix:'scene.room' })` → ~80 defs, grouped `Room / Shell`, `Room / Camera`, `Room / Light / Key`, … Rarely used fields are marked `advanced`; key params are `modulatable`. Arrays (`colorRingColors`) become 6 colour params; `mute` becomes 8 booleans; `solo` becomes an enum. |
| Discrete choices | `scene.room.content`, `scene.room.space`, `scene.room.theme`, `scene.room.quality` enums. |
| Presets | Every built-in preset becomes a runtime `Preset` that writes the resolved recipe in **one parameter transaction** (undoable). Themes become presets in a `Room Themes` group. |
| One writer per value | Room exposure → `render.exposure`; tone mapping → set `render.toneMapping='aces'` by the kit; DPR → left to `RenderSettings` + `runtime.quality`. |
| PostFX | `usePostFX({ id:'scene.room.ssgi', type:'ssgi', minTier:'balanced', fallback:'gtao', params })` + `traa` (fallback `fxaa`). The scene's own `ScenePostFX` is not mounted (`postfx="external"`). |
| Quality | `runtime.quality.register('scene.room', q => …)` sets SSGI slices/steps and the BallSim population budget from `q.tier` and `q.scalar`. |
| Bounds | Published as runtime signals `scene.bounds.{left,right,floor,ceiling,back,front,radius}`, so graphs, bindings and InputFlow routes can use the live room size. Also published as resource `scene.room.bounds` (the channel object). |
| Commands | Next/previous theme, next/previous space, next preset, toggle autoplay, toggle bounds helper → runtime commands (Ctrl/Cmd+K). No raw `window` key listeners. |
| Resources | Plaster maps and room geometry are registered with the runtime resource manager so the Telemetry panel shows them and project dispose frees them. |
| Content | The project's `Content` is the fitted subject; `fitKey` comes from the parameter `scene.room.fitKey` or from content identity. |

### 4.3 Template project

`src/adaptive-room.project.tsx` (auto-discovered by `main.tsx`):

```tsx
import { defineArtinosProject } from '@artinos/r3f'
import { adaptiveRoomKit } from '@artinos/scenes/artinos'

const room = adaptiveRoomKit({ preset: 'atelier', content: 'sculpture' })

export default defineArtinosProject({
  id: 'adaptive-room', name: 'Adaptive Room', version: '1.0.0', shell: 'studio',
  renderer: { backend: 'auto', dpr: [.75, 2], shadows: true, postfx: true },
  stage: room.stage,            // { environment:false, camera:false, controls:false, lighting:false, shadows:false, grid:false, fog:false }
  parameters: room.parameters,
  presets: room.presets,
  modules: room.modules,
  setup: room.setup,            // commands, quality consumer, bounds signals
  Content: room.Content,        // <ArtinosAdaptiveRoom>{/* optional host subject */}</ArtinosAdaptiveRoom>
})
```

Other templates can reuse the kit with their own subject:
`Content: () => <room.Scene><MyModel/></room.Scene>`.

---

## 5. Implementation phases

Each phase ends with a green `pnpm typecheck && pnpm test && pnpm doctor && pnpm build`.

### Phase 0 — Compatibility spike (½ day)
- Copy `room/**` into a throwaway `src/_spike.project.tsx`, change `Canvas gl` → the boilerplate canvas, and run it with the stage disabled by hand.
- Verify on three 0.185.1 / R3F 10 alpha: shell geometry, SSGI+TRAA tier builds, whether a priority-1 `useFrame` still takes over rendering, RectAreaLight with `setLTC`, WebGL2 backend fallback (`?backend=webgl2`).
- **Exit:** a list of confirmed API deltas; decision on R3F v9 support (D2).

### Phase 1 — Scaffold + pure model (1 day)
- Create `packages/scenes` (package.json, tsconfig, README, barrels). Wire it into the workspace, root deps, doctor, and the boundary test.
- `core/*`: scene-definition, param-schema, recipe, registry, bounds channel, storage, bundle.
- `adaptive-room/model/*`: split `params.ts`, `lighting.ts`, `themes.ts`, `presets.ts` (by collection), `quality.ts`. Write `schema.ts`.
- **Tests** (`tests/scenes-model.test.mjs`):
  - `fitFrustum`: coverage ≤ `MAX_COVER` across aspect 0.3–4 and fov 8–110; `width ≥ visW + FRONT_PAD`; monotonic in aspect.
  - `computeSubjectScale`: never exceeds the hard cap; handles zero-size subjects.
  - Every preset references an existing theme/space/content; every preset param key exists in the schema and is within range.
  - `resolveRecipe` layering order; `coerce` drops NaN and wrong types.
  - `parseBundle` rejects foreign or malformed input.

### Phase 2 — R3F layer + standalone scene (2 days)
- Split `AdaptiveRoom.tsx` → `RoomLayout`, `AdaptiveRoom`, `RoomCameraRig`, `SubjectFit`. Behaviour stays identical: the same damping lambda (6.5) and the same frame priority (-1).
- Replace `environment.bounds` with `SceneBoundsProvider`. Update spaces, BallSim, PendulumWave, Kinetic and FloatingStage to read from context. Keep `exposeGlobalBounds`.
- Move `geometry/*` over; plaster maps are ref-counted.
- LightingRig: add `RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())`; keep the spot fallback.
- `SceneCanvas`, `ScenePostFX` (`postfx: 'auto' | 'external' | false`), `SceneBackground`, `ExposureController`.
- `useSceneController` (generic) + `useAdaptiveRoomController` (the App.tsx logic without React UI): preset/theme/space apply, capture, fork, overwrite, delete, import/export, dirty flag, autoplay, storage adapter, optional URL-hash sync.
- `AdaptiveRoomScene`.
- **Visual parity check:** for the presets `atelier`, `golden-hall`, `noir-orbit`, `ball-pit`, `metronome`, `runway-show` and `lit-club-rgb`, take zip-vs-package screenshots at 16:9, 9:16 and 21:9.

### Phase 3 — ARTINOS runtime + stage changes (1–1.5 days)
- `@artinos/r3f`: `stage` opt-out (4.1-1) + test.
- `@artinos/runtime`: SSGI composite + params + quality tie-in (4.1-2) + test.
- Docs: `SCENE-STAGE.md` (opt-out), `POSTFX.md` (SSGI params), `PACKAGES.md` (new tier).

### Phase 4 — ARTINOS adapter + template (1.5 days)
- `schemaToParameters`, `presetsToRuntime`, `useRuntimeSceneState`, bounds signals, PostFX requests, quality consumer, commands.
- `adaptiveRoomKit` + `src/adaptive-room.project.tsx`.
- Verify in the studio: Inspector groups and ranges, preset apply/undo, PostFX panel shows SSGI/TRAA as `active`/`fallback`, Telemetry resources, project switch (default ↔ adaptive-room) leaks nothing (renderer info memory counts return to baseline), and a `Graph` node can read `scene.bounds.right`.
- Decide D6 (the old `adaptive-room` environment preset).

### Phase 5 — Scene UI on `@artinos/ui` (2 days)
- `@artinos/scenes/ui`: preset browser (collections, search, user presets, fork/overwrite, import/export), theme grid + custom theme editor, space picker, light channel mixer (mute/solo/gel/Kelvin), all built from `@artinos/ui` primitives and tokens.
- Register as a studio panel from the kit (`room.panels`), so the Inspector is not the only editing surface.
- Accessibility pass (keyboard, focus, contrast) with the existing UI tests.

### Phase 6 — Hardening + second scene readiness (1 day)
- StrictMode double-mount; rapid preset cycling (autoplay at 1 s) for 10 minutes with no geometry or texture growth.
- Perf budget: `balanced` holds 60 fps at 1080p on the reference GPU; `low` holds 60 fps on integrated graphics. BallSim population scales with `quality.scalar`.
- README with a copy-paste standalone example; `examples/adaptive-room-standalone/` (optional) that keeps the original Tailwind UI as a reference app.
- Write a short "Authoring a new scene" guide in the package README against the `SceneDefinition` contract.

**Estimated total: ~9–10 working days.**

---

## 6. File migration map

| Zip source | Destination | Change |
|---|---|---|
| `room/params.ts` | `adaptive-room/model/room-params.ts`, `model/frustum.ts`, `core/bounds.ts` | singleton removed; `clamp` → `core/damp.ts` |
| `room/AdaptiveRoom.tsx` | `components/RoomLayout.tsx`, `AdaptiveRoom.tsx`, `RoomCameraRig.tsx`, `SubjectFit.tsx`, `model/subject-fit.ts` | split; logic unchanged |
| `room/roomGeometry.ts` | `geometry/RoomShellGeometry.ts` | as-is |
| `room/textures.ts` | `geometry/plaster-maps.ts` | ref-counted |
| `room/lighting.ts` | `model/light-params.ts`, `light-modes.ts`, `color-schemes.ts`, `light-math.ts`, `staging-params.ts` | split |
| `room/LightingRig.tsx` | `components/LightingRig.tsx` | `setLTC` fix |
| `room/StagingRig.tsx` | `components/StagingRig.tsx` | as-is |
| `room/spaces.tsx` | `components/spaces/*.tsx` + `model` registry data | one file per space; shape helpers → `geometry/shapes.ts` |
| `room/environments.tsx` | `components/contents/*.tsx` + registry | renamed "content" (avoids a clash with ARTINOS "environment") |
| `room/BallSim.tsx`, `PendulumWave.tsx`, `Kinetic.tsx` | `components/contents/` | bounds from context; population from quality |
| `room/themes.ts`, `presets.ts`, `quality.ts` | `model/` (presets split by collection) | `Preset` → `SceneRecipePreset` |
| `room/PostFX.tsx` | `react/ScenePostFX.tsx` | `mode` prop; takes over the frame only when standalone |
| `room/BoundsHelper.tsx` | `react/BoundsHelper.tsx` | context bounds |
| `App.tsx` | `react/useSceneController.ts`, `adaptive-room/AdaptiveRoomScene.tsx`, `react/SceneCanvas.tsx`, `react/useSceneShortcuts.ts` | UI removed |
| `store.ts` | `core/storage.ts`, `core/bundle.ts`, `core/ids.ts` | adapter-based |
| `components/**`, `index.css`, `utils/cn.ts` | `examples/` (reference) → rebuilt in `ui/` (phase 5) | not in core |
| `ErrorBoundary.tsx`, `main.tsx`, `vite.config.ts`, `index.html` | dropped (boilerplate provides these) | — |

---

## 7. Decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | Package name | `@artinos/scenes` (a collection; the adaptive room is the first entry). |
| D2 | R3F support range | Target v10 alpha (boilerplate pin). Keep v9 only if Phase 0 shows it needs no shims beyond `renderer`/`gl`. |
| D3 | Where the ARTINOS adapter lives | Inside the package as the `./artinos` subpath, with `@artinos/runtime` as an optional peer. This keeps the scene and its integration versioned together, while the core stays independent (enforced by the boundary test). |
| D4 | Panel UI | Rebuild on `@artinos/ui` (phase 5); keep the Tailwind UI only as a reference example. |
| D5 | Stage ownership | Add a `stage` opt-out to `ArtinosProject` instead of faking it with `environment:'blank'`/`lighting:'none'`, because `shadows:'off'` would also turn off renderer shadow maps and the Camera component would still write to the camera. |
| D6 | Existing `adaptive-room` environment preset in `@artinos/modules` | Keep it for now (it is a lightweight backdrop, not this scene). Rename its label to "Adaptive Backdrop" in Phase 4 so the two aren't confused. |
| D7 | Room SSGI vs shared pipeline | Fix the shared pipeline (4.1-2) instead of letting the room render itself inside ARTINOS. |

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| R3F v10 alpha scheduler changes break the priority-based render takeover | Medium | Standalone `ScenePostFX` uses R3F v10's render-phase API if present; ARTINOS path never takes over the frame. |
| SSGI composite change alters other projects' look | Medium | SSGI is off by default; a regression test pins the node graph; release note in `STUDIO-UPGRADE.md`. |
| ~80 parameters clutter the Inspector | High | Grouping + `advanced` flags + the dedicated room panel (phase 5). |
| Visual drift from the zip (damping, light values) | Medium | Screenshot parity check in Phase 2; logic moved verbatim before any refactor. |
| three bump to 0.186 needed for an API | Low | APIs checked against 0.185.1 already; the Phase 0 spike confirms it at runtime. |
| Memory leak on project switch (maps, geometry, lights, PostFX nodes) | Medium | Ref-counted resources + runtime resource registration + a switch test in Phase 4. |

## 9. Acceptance criteria

1. `packages/scenes` typechecks alone; the boundary test proves core imports only `react`, `three*` and `@react-three/fiber`.
2. A plain Vite + R3F app renders `<SceneCanvas><AdaptiveRoomScene preset="atelier"/></SceneCanvas>` with no other setup.
3. `?project=adaptive-room` runs in the studio: every preset applies as one undoable transaction, all controls appear in the Inspector, and SSGI/TRAA show in the PostFX panel with correct fallback states.
4. Resizing from 9:16 to 21:9 recomposes the room smoothly; the frustum never leaves the opening; a fitted subject never breaches the shell.
5. Bounds are available as runtime signals and via `useSceneBounds()`; BallSim collides with the visible walls at every aspect.
6. Switching projects 20 times returns renderer memory counts to baseline.
7. The seven parity presets match the zip visually at three aspect ratios.
8. `pnpm typecheck && pnpm test && pnpm doctor && pnpm build` are green.

## 10. Open questions

- Should user presets and themes created in the studio be saved with the ARTINOS project file, or only in browser storage like the zip does?
- Should BallSim move to a GPU compute path later, like VOLUMA? It is out of scope for v1.
- Which scenes come next? That decides whether `SceneDefinition.variants` needs more than "spaces" and "contents".
