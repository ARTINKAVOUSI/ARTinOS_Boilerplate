# ARTINOS v2

A React 19 / React Three Fiber 10 / three.js WebGPU boilerplate in which every capability is a copy-pastable file or folder: 46 PostFX effects, 17 scene features, 8 objects plus the glass material, 8 input devices, 2 overlays, 10 studio panels, 29 UI components, the MetaBlock docking engine and the node graph.

The studio is the original ARTINOS one: a MetaBlock dock along the bottom with one tab per section (Inspector, Scene, PostFX, InputFlow, Graph, Assets, Library, Console, Telemetry, Appearance). Tabs can be dragged out to float, split or merge, returned to the dock, or maximized, and the layout is saved.

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

The architecture rules live in `CLAUDE.md` and the skill in `.claude/skills/copy-pastable-reusable-react/` — every capability is a file or a folder you can paste in or delete.

Put a `.tsx` file under `src/panels/` that exports a component and a `panel` manifest (`id`, `title`, `order`, `component`). It becomes a dock tab and a palette entry. Delete the file and the tab is gone.

## Use a piece in another project

| Copy | Then |
|---|---|
| `src/ui/Slider/` | `import { Slider } from './Slider/Slider'` |
| `src/ui/MetaBlock/` | `new MetaBlockWorkspace()` + `<MetaBlockWorkspaceView workspace={…} renderBlock={…} />` |
| `src/features/postfx/PostFX.tsx` + `effects/Bloom.tsx` | `<Canvas …><PostFX><Bloom strength={0.8} /></PostFX></Canvas>` |
| `src/features/scene/Fog.tsx` | `<Fog mode="exponential" density={0.05} />` inside your canvas |
| `src/app/signals.tsx` + `src/features/input/AudioInput.tsx` | `<AudioInput source="microphone" />`, then `useSignals().get('audio.bass')` in `useFrame`; fix the one `signals` import path after pasting |
| `src/features/postfx/PostFX.tsx` + `src/features/objects/glass/` (minus `GlassInspector.*`) | `<mesh><torusGeometry /><GlassMaterial ior={1.3} dispersion={6} /></mesh>` inside `<PostFX>` |
| `src/ui/NodeGraph/` | `<NodeGraph …/>` and `<LiveGraphView …/>`; needs `three` for the GPU domain |

PostFX effects need three ≥ 0.185 with `WebGPURenderer` and R3F ≥ 10. The UI components need only React; importing `src/ui/theme/theme.css` is optional and adds the six material worlds (`<html data-world="graphite">`).

## Keys

Tab strip: drag a tab out to float it · `H` hides the interface · `Ctrl/⌘ K` opens the command palette (the one search box: panels, features, any control by name) · on a slider: Shift for fine control, double-click to reset, Enter to type a value.

See [docs/PLAN.md](docs/PLAN.md) for the architecture, the v1 → v2 mapping and what is left.
