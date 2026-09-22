# @artinos/ui

A self-contained React design system: tokens, material worlds, instruments and a workspace shell.

Depends on `react` and `react-dom` (peers) and `lucide-react`. Nothing else — no ARTINOS
package, no renderer, no CSS framework. `tests/ui-boundary.test.mjs` fails the build if that
ever changes.

**Source of truth:** [`VISUAL_REFERENCES/artinos-core-ui.html`](VISUAL_REFERENCES/artinos-core-ui.html).
Its tokens, its six material worlds, its component anatomy and its interaction behaviour are
what this package implements.

## The UI Studio

`?studio` is the whole system in one page, built from these components, floating on a living
scene with the reference's world bar along the bottom.

| Section | What it holds |
| --- | --- |
| Core | the reference's two panels rebuilt from the kit, value for value — the acceptance page |
| Foundations | ink, signal, lines, type, metrics, surfaces and motion |
| Controls | every input live |
| Instruments | XY pad, knobs, scopes, envelopes, curves, gradients, colour pickers, readouts |
| Composition | pane layouts, property rows, collections, virtual lists, floating layers, files |

The right-hand drawer edits the world, the scene and every token under them; **Copy CSS**
hands back only what changed. It docks beside the work when there is room, floats over it
when there is not, and is never hidden.

### How Core is held to the reference

The reference is served from this package, so the studio can load it same-origin and compare:

- **Computed styles** — 44 element pairs × 23 properties, plus the panel's grain and luminance
  layers: every visually rendered property matches. The only differences are inherited font
  size on containers that draw no text, and user-agent defaults on text-less buttons.
- **Geometry** — panel, head, tabs, capsule, fill, seam, segmented insert, select, well and
  toggle land on the same sub-pixel boxes.
- **Behaviour** — the same pointer and keyboard gestures produce the same values in both.

One deliberate deviation: the reference's colour stack collapses its hue rail to 0px wide.
Here the rail and swatch take the full row.

## The material

Six interpretations of **one** material. A world moves transmission, diffusion, roughness,
density, depth and mass together — never a hue swap.

| `data-world` | Character |
| --- | --- |
| `clear` | highest transmission, lightest mass |
| `frost` | **the canonical surface — the default, no attribute needed** |
| `satin` | silkier glass, porcelain active regions |
| `graphite` | smoked, long-session professional |
| `opal` | chalk and mineral, carved controls |
| `monolith` | densest body, glass surviving underneath |

Set it on any element; everything inside follows. Motion changes with it: each world carries
its own `--ui-mass`, `--ui-spring` and `--ui-damp`, so the segmented insert and toggle knob are
quick in Clear and heavy in Monolith.

## Tokens

Every reference token keeps its name behind a `--ui-` prefix — `--sig` is `--ui-sig`,
`--body-in` is `--ui-body-in` — so the package can sit on any page without claiming generic
names like `--ink` or `--glass`.

| Layer | File | Tokens |
| --- | --- | --- |
| core | `tokens.css` | `--ui-sig*`, `--ui-ink*`, `--ui-r-*`, `--ui-h-comp*`, `--ui-gap-row`, `--ui-pad-panel`, `--ui-face`, `--ui-num`, `--ui-t-*` |
| material | `worlds.css` | `--ui-glass`, `--ui-glass-top`, `--ui-blur`, `--ui-sat`, `--ui-grain`, `--ui-edge`, `--ui-edge-lit`, `--ui-depth`, `--ui-body`, `--ui-body-in`, `--ui-active-*`, `--ui-ink-active`, `--ui-seam`, `--ui-well`, `--ui-mass`, `--ui-spring`, `--ui-damp` |
| aliases | `tokens.css` | the component vocabulary the rest of the kit reads (`--ui-text-*`, `--ui-pane-*`, `--ui-range-*` …), derived from the two above |

Aliases re-derive on every `[data-world]` and `[data-theme]` scope: a custom property inherits
its computed value, so an alias resolved once on `:root` would freeze the default world into
every re-themed subtree.

`themes.css` keeps the older `data-theme` overlays the studio app's workspace still uses.

## Anatomy

| Component | Reference | |
| --- | --- | --- |
| `Pane` | `.panel` | title, `meta` as the path under it, `status` dot and `actions` in the corner, `toolbar`, `footer`. No border — every edge is light. |
| `Field` | `.mc` | the MetaComp row: 62px name, the control, a 7px marker column when there is one |
| `Slider` | `.cap` | the capsule — see below. `size="compact"` is the 19px body. |
| `NumberWell` · `NumberField` · `VectorField` · `DimensionField` | `.field` · `.mc__vec` · `.mc__pair` | recessed wells; scrub across, click to type |
| `Select` · `SelectShell` | `.select` | a raised body with the chevron |
| `Segmented` | `.seg` | the active insert rises from the frost and travels on the world's spring |
| `Toggle` | `.tgl` | a knob on a spring; its seam tick takes the signal when on |
| `Tabs` | `.tabs` | a 1.5px signal underline on the selected tab |
| `ColorField` · `HueBar` | `.swatch` · `.hue` | the surface is the visualization |
| `MicroReadout` | `.micro` | an 18px readout that scrubs |
| `Button` · `IconButton` · `Toolbar fill` | `.btn` · `.iconbtn` · `.btn-row` | |
| `PinButton` | `.mod` | the modulation marker — the accent as information |
| `Section` · `Collapsible` | `.section` | a spaced word and a rule to the panel edge |
| `SceneBackdrop` | `#scene` | living content under the glass: `atelier`, `garden`, `studio` |

### The capsule

The whole capsule is the control. A denser active insert moves through a softer body, a seam
marks the exact value, and the name and value ride inside **twice** — once in each ink,
clipped at the seam — so both halves stay readable whichever material they land on.

It behaves like the reference instrument:

- **Press** anywhere to place the value, then **drag** relative from there.
- **Shift** refines to 0.18×; a slow drag refines to 0.55× on its own.
- **Quarter detents** pull only while you move deliberately.
- **Arrows** move 1% of the range (one step with Shift); **Page Up/Down** move 10%.
- **Contact compression** — the capsule gives to 0.985 under the hand and springs back.
- Double-click resets; Enter types a value.

Those mechanics live in the kernel (`ControlSpec` gains `precisionKey`, `slowPrecision`,
`softDetents`, `nudgeFraction`, `fastVelocity`), opt-in, so every other control keeps its own feel.

## Use it anywhere

```tsx
import '@artinos/ui/theme.css'
import { Pane, Section, Slider, Segmented, Toggle } from '@artinos/ui'

export function Lighting() {
  const [exposure, setExposure] = useState(1.2)
  const [mode, setMode] = useState('Area')
  const [shadows, setShadows] = useState(true)
  return (
    <Pane title="Lighting" meta="Scene / Light" status="live">
      <Section title="Light">
        <Slider label="Exposure" value={exposure} min={-4} max={4} step={0.1} unit="EV" onChange={setExposure} />
        <Segmented label="Mode" value={mode} options={['Area', 'Point', 'Sun']} onChange={setMode} />
        <Toggle label="Shadows" value={shadows} onChange={setShadows} />
      </Section>
    </Pane>
  )
}
```

Glass needs something to transmit. Put the panels over a `SceneBackdrop` (or your own canvas,
video or 3D view) and choose a world:

```tsx
<div data-world="graphite" style={{ position: 'relative' }}>
  <SceneBackdrop environment="studio" />
  <Lighting />
</div>
```

## Layers

| Layer | Import | What it is |
| --- | --- | --- |
| `primitives/` | `@artinos/ui/primitives` | styled controls — pane, field, capsule, choices, wells, lists |
| `headless/` | `@artinos/ui/headless` | behaviour only — fuzzy match, virtualization, persistence, dismissal |
| `shell/` | `@artinos/ui/shell` | app bar, scene, workspace, docking, panel system, command palette |
| `kernel/` | `@artinos/ui/kernel` | framework-free control mechanics — drag, precision, detents, physics |

## Panels

Declare a panel with `definePanel` and pass it to `PanelWorkspace`. It appears in the dock,
the rail and the command palette at once. The toolbar's status slot takes any readout:

```tsx
<PanelWorkspace panels={panels} viewport={viewport} toolbarStatus={<MyStatus />} />
```

Every layout transition is a pure function in `shell/panel-layout.ts` (`move`, `focus`,
`soloInDock`, `resize`, …). Change behaviour there, not in a component.

Runtime-bound panels (parameters, scene, PostFX, graph, telemetry, the runtime HUD) live in
`@artinos/r3f` under `src/studio`, which composes this package with the ARTINOS runtime.
