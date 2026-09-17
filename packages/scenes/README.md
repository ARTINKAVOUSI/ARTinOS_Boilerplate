# @artinos/scenes

Preset, fully configured, ready-to-use 3D scenes for React Three Fiber + `three/webgpu`.
A scene brings its own architecture, camera, lighting, staging, themes, presets and
post-processing. You pass your content in and get a finished stage.

The core is independent: it depends only on `react`, `three` and `@react-three/fiber`
(peers; R3F v10). The ARTINOS integration lives in `@artinos/scenes/artinos`, the only
entry point that imports `@artinos/runtime`. `tests/scenes-boundary.test.mjs` enforces this.

## Scenes

| Scene | Entry | What it is |
|---|---|---|
| Adaptive Room | `@artinos/scenes/adaptive-room` | Open-front plaster chamber that re-composes itself to the camera frustum. 8-channel studio light rig, staging (plinth, turntable, catcher, backdrop), 9 architectural spaces, 7 built-in content pieces, 18 themes, ~60 presets, SSGI + TRAA. |

## Stand-alone use

```tsx
import { SceneCanvas, AdaptiveRoomScene } from '@artinos/scenes'

// Complete scene: renderer, post-processing, exposure and DPR included
<SceneCanvas>
  <AdaptiveRoomScene preset="golden-hall" />
</SceneCanvas>

// Your own subject, measured and fitted into the composition safe area
<SceneCanvas>
  <AdaptiveRoomScene preset="atelier" content={null} fitKey={model.uuid}>
    <primitive object={model} />
  </AdaptiveRoomScene>
</SceneCanvas>
```

### Controlled, with your own UI

```tsx
import { useAdaptiveRoomController, useAdaptiveRoomShortcuts } from '@artinos/scenes'

const room = useAdaptiveRoomController({ syncHash: true })   // localStorage by default
useAdaptiveRoomShortcuts(room)                               // optional: 1–7 [ ] q e space

<AdaptiveRoomScene {...room.sceneProps} />

room.applyPreset('noir-orbit'); room.applyTheme('sage'); room.applySpace('runway')
room.setLight({ keyIntensity: 3 }); room.savePreset('My look'); room.exportBundle()
```

The controller keeps the original app's storage keys and bundle format, so setups exported
from the stand-alone Adaptive Room app import unchanged.

### Composing parts

```tsx
<AdaptiveRoom params={state.room} light={state.light} staging={state.staging}>
  <MySubject />
</AdaptiveRoom>
```

Everything inside `AdaptiveRoom` can read the live interior with `useBoundsChannel()`
(per frame, no re-render) or `useSceneBounds()` (React state). Each room has its own
channel; `exposeGlobalBounds` also publishes `window.environment.bounds` for legacy code.

## Data model

`adaptive-room/model` is pure TypeScript with no React or three. It holds the schemas
(`ROOM_SCHEMA`, `LIGHT_SCHEMA`, …), `resolvePreset`, `applyTheme`, `applySpace`,
`captureRecipe`, `coerceRoomState` and `fitFrustum`. A preset resolves as
`defaults ← theme ← space overrides ← preset params`. Every scene is described by a
`SceneDefinition` (`adaptiveRoom`), which is what generated UIs and hosts read.

## ARTINOS

```tsx
import { defineArtinosProject } from '@artinos/r3f'
import { adaptiveRoomKit } from '@artinos/scenes/artinos'

const room = adaptiveRoomKit({ preset: 'atelier' })
export default defineArtinosProject({ id: 'room', name: 'Room', ...room.project, Content: room.Content })
```

The kit provides:

- **Stage** turns off the shared environment, camera, controls, lights, shadows, fog and
  grid. Render settings stay with the host.
- **Parameters**: about 90 `scene.room.*` parameters grouped under `Room / …` in the Inspector.
- **Presets**: every built-in preset, theme (`room-theme:*`) and space (`room-space:*`) as
  runtime presets.
- **Post-processing**: turns on the host pipeline's SSGI + TRAA. Presets write exposure
  and SSGI strength onto `render.exposure` and `postfx.ssgi.*`, so each value has one writer.
- **Commands**: `scene.room.preset.apply|next`, `scene.room.theme.next|previous`,
  `scene.room.space.next|previous` and `scene.room.bounds.toggle`, all bindable in the
  Interaction panel.
- **Signals**: the live interior as `scene.bounds.{left,right,floor,ceiling,back,front,radius,size}`,
  plus the channel object as the `scene.room.bounds` resource.

To stage your own subject: `Content: () => <room.Scene fitKey="model"><Model/></room.Scene>`
with `adaptiveRoomKit({ content: null })`.

## Layout

```
src/
  core/          scene contract, param schema, bounds channel, storage, math   (no React)
  react/         bounds context, SceneCanvas, ScenePostFX, render controls, R3F v9/v10 shims
  adaptive-room/
    model/       params, frustum, subject fit, lighting, themes, spaces, contents, presets, schema, state, bundle
    geometry/    RoomShellGeometry, ref-counted plaster maps
    components/  AdaptiveRoom, LightingRig, StagingRig, spaces/, contents/
    AdaptiveRoomScene.tsx · controller.ts · shortcuts.ts · definition.ts
  artinos/       runtime adapter (the only runtime importer)
```
