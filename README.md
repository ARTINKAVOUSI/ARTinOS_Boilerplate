# ARTINOS

A React 19 / React Three Fiber 10 / three.js WebGPU boilerplate in which every capability is a copy-pastable file or folder. Add one by pasting it in, remove it by deleting it — nothing else in the project changes either way.

Out of the box: 46 PostFX effects, 16 scene features, 8 objects plus the glass material, 8 input devices, 2 overlays, 8 studio panels, the ARTINOS UI system (26 components, the MetaBlock docking engine and the node graph).

```sh
pnpm install
pnpm dev        # http://localhost:5190
pnpm typecheck
pnpm build
```

## The studio

A MetaBlock dock with one tab per panel — Inspector, Scene, PostFX, InputFlow, Graph, Assets, Library, Console. Tabs drag out to float, split, merge or dock on any edge; right-click a tab strip for placement drawn as diagrams. The layout is saved.

The readout at the right of the dock strip opens the **studio bar**: frame rate and history, renderer load, the quality tier, the theme, and the studio's own switches (advanced controls, hide, presets, resets).

The **Console** panel holds the runtime log and a built-in renderer profiler (the useful half of three.js's Inspector, `src/app/profiler.ts`): every render and compute pass of a frame with its CPU and GPU time, and GPU memory by kind. It measures only while one of its views is open.

Keys: `H` hides the interface · `Ctrl/⌘ K` opens the command palette (panels, features, any control by name) · on a slider, Shift for fine control, double-click to reset, Enter to type · right-click a control row to reset, copy or paste its value.

## Layout

```
src/
  app/        the host: registry, store, runtime, signals, graphs, and the studio (app/studio)
  features/   scene objects, effects, input devices, overlays — one file each, found by glob
  panels/     dock tabs — one file each, found by glob
  ui/         the ARTINOS UI system: system/ (tokens, themes, anatomy) + one folder per component
docs/         PLAN.md (architecture), ui/ (component and theming reference)
```

The rules that keep every unit deletable are in [CLAUDE.md](CLAUDE.md); the full architecture is in [docs/PLAN.md](docs/PLAN.md).

## Add or remove a feature

- **Add:** put a `.tsx` file under `src/features/` that exports a component and a `feature` manifest. It appears in the scene, the panels, the palette, presets and saved state.
- **Remove:** delete the file. Saved settings for it are dropped automatically.

```tsx
import type { Feature } from '../../app/feature'

export function Fog({ color = '#1a1c1f', near = 8, far = 30 }) {
  return <fog attach="fog" args={[color, near, far]} />
}

export const feature: Feature = {
  id: 'scene.fog', label: 'Fog', kind: 'scene', group: 'Atmosphere',
  component: Fog,
  controls: { color: { type: 'color', value: '#1a1c1f' }, near: { type: 'number', value: 8, min: 0, max: 100 } },
}
```

## Add or remove a panel

Put a `.tsx` file under `src/panels/` that exports a component and a `panel` manifest (`id`, `title`, `order`, `component`). It becomes a dock tab and a palette entry. Delete the file and the tab is gone.

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

A `src/ui` component imports only its own folder and `src/ui/system/`. PostFX effects need three ≥ 0.185 with `WebGPURenderer` and R3F ≥ 10.

The v1 workspace this was rebuilt from is preserved at the git tag `v1.4-final`.
