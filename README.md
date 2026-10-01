# ARTINOS

A React 19 / React Three Fiber 10 / three.js WebGPU boilerplate in which every capability is a copy-pastable file or folder. Add one by pasting it in, remove it by deleting it — nothing else in the project changes either way.

Out of the box: 46 PostFX effects, 16 scene features, 8 objects plus the glass material, 8 input devices, 2 overlays, 8 studio panels, and the ARTINOS UI system (26 components, the MetaBlock docking engine and the node graph).

## Quick start

Requires Node 20+ and pnpm. Runs on WebGPU (Chrome/Edge 113+, Safari 26+) and falls back to WebGL2 elsewhere.

```sh
pnpm install
pnpm dev        # http://localhost:5190 (PORT=5191 pnpm dev for a second copy)
pnpm typecheck
pnpm build      # type-checks, then builds to dist/
```

## The studio

A MetaBlock dock with one tab per panel — Inspector (the parameters of everything on the canvas), Library (every component by category, to add to the canvas, plus assets and the source kit), InputFlow, Graph, Console. Tabs drag out to float, split, merge or dock on any edge; right-click a tab strip for placement drawn as diagrams. The layout is saved.

The readout at the right of the dock strip opens the **studio bar**: frame rate and history, renderer load, the quality tier, the theme, and the studio's own switches (advanced controls, hide, presets, resets).

The **Console** panel holds the runtime log and a built-in renderer profiler (`src/app/profiler.ts`): every render and compute pass of a frame with its CPU and GPU time, and GPU memory by kind. It measures only while one of its views is open.

Keys: `H` hides the interface · `Ctrl/⌘ K` opens the command palette (panels, features, any control by name) · on a slider, Shift for fine control, double-click to reset, Enter to type · right-click a control row to reset, copy or paste its value.

## Layout

```
src/
  app/        the host: registry, store, runtime, signals, graphs, and the studio (app/studio)
  features/   scene objects, effects, input devices, overlays — one file each, found by glob
  panels/     dock tabs — one file each, found by glob
  ui/         the ARTINOS UI system: system/ (tokens, themes, anatomy) + one folder per component
public/       backdrop and environment images, the demo model, Draco and MediaPipe runtimes
docs/         PLAN.md (architecture), ui/ (component and theming reference)
```

The rules that keep every unit deletable are in [CLAUDE.md](CLAUDE.md); the full architecture is in [docs/PLAN.md](docs/PLAN.md).

## Add or remove a feature

- **Add:** put a `.tsx` file under `src/features/` that exports a component and a `feature` manifest. It appears in the scene, the panels, the palette, presets and saved state.
- **Remove:** delete the file. Saved settings for it are dropped automatically.

```tsx
import type { Feature } from '../../app/feature'

export function Fog({ color = '#1a1c1f', near = 8, far = 30 }) {
  return <fog attach="fog" color={color} near={near} far={far} />
}

export const feature: Feature = {
  id: 'scene.fog', label: 'Fog', kind: 'scene', group: 'Atmosphere',
  description: 'Distance fog in the scene colour.',
  component: Fog,
  controls: { color: { type: 'color', value: '#1a1c1f' }, near: { type: 'number', value: 8, min: 0, max: 100 } },
}
```

Each feature is mounted with its own state, so a control change re-renders that feature alone. A control that changes often should reach the GPU as a uniform (see `useUniform` in `src/features/postfx/PostFX.tsx`), not rebuild a material or the effect chain.

## Add or remove a panel

Put a `.tsx` file under `src/panels/` that exports a component and a `panel` manifest (`id`, `title`, `order`, `component`). It becomes a dock tab and a palette entry. Delete the file and the tab is gone. Only the active tab of each dock group is mounted.

## Start a new project from this template

1. Delete what you will not use: whole folders under `src/features/` (e.g. `input/`, `objects/glass/`), single effects in `src/features/postfx/effects/`, panels in `src/panels/`, UI components in `src/ui/`. Run `pnpm build` after each deletion — a failure means an import crossed a boundary.
2. Replace the demo assets in `public/` (see below) or point the features at your own.
3. Rename the project: `package.json`, the `<title>` in `index.html`, the brand chip in `src/app/studio/DockShell.tsx`, and the storage keys (`artinos.v2.*` in `src/app/store.ts`, `src/app/graphs.ts`, `src/app/studio/layout.ts`, and the workspace id in `DockShell.tsx`) so a new project does not read another one's saved state.
4. Set the defaults you want in each feature's manifest — `enabled`, control values, `order`.

## Use a piece in another project

| Copy | Then |
|---|---|
| `src/ui/system/` + `src/ui/Slider/` | import `ui/system/system.css` once, then `import { Slider } from './Slider/Slider'` |
| `src/ui/MetaBlock/` | `new MetaBlockWorkspace()` + `<MetaBlockWorkspaceView workspace={…} renderBlock={…} />` |
| `src/features/postfx/PostFX.tsx` + `effects/Bloom.tsx` | `<Canvas …><PostFX><Bloom strength={0.8} /></PostFX></Canvas>` |
| `src/features/scene/Fog.tsx` | `<Fog mode="exponential" density={0.05} />` inside your canvas |
| `src/app/signals.tsx` + `src/features/input/AudioInput.tsx` | `<AudioInput source="microphone" />`, then `useSignals().get('audio.bass')` in `useFrame`; fix the one `signals` import path after pasting |
| `src/features/postfx/PostFX.tsx` + `src/features/objects/glass/` (minus `GlassInspector.*`) | `<mesh><torusGeometry /><GlassMaterial ior={1.3} dispersion={6} /></mesh>` inside `<PostFX>` |
| `src/ui/NodeGraph/` | `<NodeGraph …/>` and `<LiveGraphView …/>`; needs `three` for the GPU domain |

A `src/ui` component imports only its own folder and `src/ui/system/`. PostFX effects need three ≥ 0.185 with `WebGPURenderer` and R3F ≥ 10. Outside this app, a feature's `export const feature` block is optional — delete it with its `import type`.

## Assets in `public/`

| Path | Used by |
|---|---|
| `backgrounds/persian-garden.webp` | the Transition effect (default image), the studio backdrop |
| `models/glass-rings.glb` | Glass Rings, and Model's default URL (Draco-compressed) |
| `draco/` | the Draco decoder for compressed glTF, served locally |
| `mediapipe/` | the MediaPipe WASM runtime and hand model, loaded only when Hand Tracking starts |

The v1 workspace this was rebuilt from is preserved at the git tag `v1.4-final`.
