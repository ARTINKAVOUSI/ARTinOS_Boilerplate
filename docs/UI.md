# UI package

`@artinos/ui` is four layers. Each one is usable without the layer above it, which is what
makes the control kit portable to a project that has no ARTINOS runtime at all.

```text
packages/ui/src/
├ headless/     behaviours, no markup      fuzzy match · virtualization · persistence · dismiss
├ primitives/   styled controls            sliders · fields · vectors · lists · browsers
├ shell/        workspace                  docking · panel system · command palette
├ panels/       runtime views              parameters · signals · telemetry · console · library
├ hooks/        runtime subscriptions      throttled reads + palette sources
└ theme.css     the token layer            .artinos-* class contract
   theme.ts     the same tokens, in code
```

Dependency rule: `panels` may use everything; `shell` and `primitives` may use `headless`;
`headless` uses only React. `scripts/check-packages.mjs` enforces the package-level graph.

## Layers in practice

### headless

No JSX. These exist so scrolling, matching, persistence and dismissal are solved once.

| Export | Use it for |
| --- | --- |
| `fuzzyMatch` / `fuzzyFilter` / `splitRanges` | subsequence search with highlight ranges |
| `useVirtual` | windowed rendering for uniform-height rows |
| `useThrottledRevision` | subscribing to a runtime store at a bounded rate |
| `usePersistentState` / `usePersistentValue` | state that survives reload, merged over defaults |
| `useDismiss` / `useShortcut` | Escape / outside-click, and global key bindings |

### primitives

Every control the panels use, grouped by family — `numeric`, `text`, `choice`, `vector`,
`files`, `actions`, `display`, `layout`, `list`. Only `ParameterControl` touches the
runtime; it is the single place where a parameter `type` maps to an editor, so adding a
type there lights it up in every panel and in the palette.

`VirtualList`, `VirtualGrid` and `ListBrowser` are the ones that matter for performance:
any list that can pass a couple of hundred rows should use them.

### shell

The panel system is deliberately three separate things:

- **`panel-types.ts`** — `definePanel({ id, title, icon, description, keywords, dock, … })`.
  One descriptor feeds the dock, the rail *and* the command palette.
- **`panel-layout.ts`** — every transition as a pure function: `move`, `focus`, `resize`,
  `soloInDock`, `toggleOpen`, `reconcile`. No React, so behaviour is readable and testable
  on its own, and no transition can capture stale state.
- **components** — `PanelHostProvider` holds the state, `PanelFrame` draws one panel,
  `DockArea` draws an edge, `PanelWorkspace` composes the lot.

To change how panels behave, edit `panel-layout.ts`. To change how they look, edit the
component and `theme.css`.

### panels

Runtime-bound views. Each is one file named after itself. They read through `hooks/`,
which throttles every runtime store to ~10 Hz — telemetry publishes every frame, and
re-rendering the dock at frame rate is what makes a dock feel heavy.

## Command palette

`Ctrl`/`Cmd`+`K`, or the search field in the dock toolbar.

It is content-aware rather than a fixed command list: sources are registered at runtime and
read live state when queried, so results carry current values and can act directly.

| Source | Shows | Enter does |
| --- | --- | --- |
| Panels | every declared panel and where it is docked | opens and focuses it |
| Parameters | id and **current value** | booleans **toggle**; others reveal in the Inspector |
| Presets | scene and PostFX presets | applies it |
| Modules | catalog entry and category | copies the canonical import |
| Signals | live signal value | reveals it |
| Actions / Quality | undo, redo, save, quality tier | runs it |

Ranking is global fuzzy match, then grouping — so a strong hit in a small source still
beats a weak hit in a large one. Recently used items get a small tiebreak boost.

### Adding your own source

```ts
import { registerCommandSource } from '@artinos/ui'

useEffect(() => registerCommandSource({
  id: 'my-scenes',
  collect: query => scenes.map(scene => ({
    id: `scene:${scene.id}`,
    title: scene.name,
    subtitle: scene.status,        // live context, shown dim
    group: 'Scenes',
    keywords: 'level chapter',
    hint: 'load',
    run: () => loadScene(scene.id),
  })),
}), [scenes])
```

Sources are called on every keystroke. For a large registry, return early below a couple of
characters and let the palette rank.

### Cross-panel reveal

A palette result can point at something the palette does not own:

```ts
import { reveal, useReveal } from '@artinos/ui'

reveal('parameter', 'scene.fog.near')          // from anywhere
const target = useReveal('parameter')          // in the panel that can show it
```

The panel decides what "show" means. `ParametersPanel` adopts the id as its query and
overrides its own filters, so a reveal never silently shows nothing.

## Theming

`theme.css` defines the tokens; `theme.ts` reads the same ones from code:

```ts
import { token, resolveToken } from '@artinos/ui'

element.style.background = token('color', 'surface')      // var(--bg-glass)
context.fillStyle = resolveToken('color', 'accent')       // resolved, for canvas and three
```

The workspace also has an `auto` theme that samples the rendered canvas on a 1.2s timer and
flips panel contrast so text stays readable over a bright or dark scene.

## Using the kit outside ARTINOS

```tsx
import { ListBrowser, Slider } from '@artinos/ui/primitives'
import { fuzzyFilter, useVirtual } from '@artinos/ui/headless'
import '@artinos/ui/theme.css'
```

Neither entry point imports the runtime, three or React Three Fiber.
