# ARTINOS v2

A React 19 / React Three Fiber 10 / three.js WebGPU boilerplate in which every capability is a copy-pastable file: 44 PostFX effects, 13 scene features, 4 objects, 4 input devices, 3 diagnostic overlays, 9 studio panels, 29 UI components and the MetaBlock docking engine.

The studio is the original ARTINOS one: a MetaBlock dock along the bottom with one tab per section (Inspector, Scene, PostFX, InputFlow, Assets, Library, Console, Telemetry, Appearance). Tabs can be dragged out to float, split or merge, returned to the dock, or maximized, and the layout is saved.

```sh
pnpm install
pnpm dev        # http://localhost:5190
pnpm typecheck
pnpm build
```

## Add or remove a feature

- **Add:** put a `.tsx` file under `src/features/` that exports a component and a `feature` manifest. It shows up in the scene and in the studio.
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
| `src/ui/Slider/` | `import { Slider } from './Slider/Slider'` |
| `src/ui/MetaBlock/` | `new MetaBlockWorkspace()` + `<MetaBlockWorkspaceView workspace={…} renderBlock={…} />` |
| `src/features/postfx/PostFX.tsx` + `effects/Bloom.tsx` | `<Canvas …><PostFX><Bloom strength={0.8} /></PostFX></Canvas>` |
| `src/features/scene/Fog.tsx` | `<Fog mode="exponential" density={0.05} />` inside your canvas |
| `src/features/input/signals.tsx` + `AudioInput.tsx` | `<AudioInput source="microphone" />`, then `useSignals().get('audio.bass')` in `useFrame` |

PostFX effects need three ≥ 0.185 with `WebGPURenderer` and R3F ≥ 10. The UI components need only React; importing `src/ui/theme/theme.css` is optional and adds the six material worlds (`<html data-world="graphite">`).

## Keys

Tab strip: drag a tab out to float it · `H` hides the interface · `Ctrl/⌘ K` opens the command palette · on a slider: Shift for fine control, double-click to reset, Enter to type a value.

See [docs/PLAN.md](docs/PLAN.md) for the architecture, the v1 → v2 mapping and the remaining phases.
