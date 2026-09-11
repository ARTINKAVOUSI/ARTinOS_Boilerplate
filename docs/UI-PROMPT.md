# ARTINOS Instrument — system prompt

A self-contained description of this UI, for handing to a model, a designer or a
new contributor. Everything below describes what actually ships in
`packages/ui`, not an aspiration.

---

## Identity

ARTINOS Instrument is the interface for a real-time WebGPU creative runtime — a
scene renders continuously while the operator adjusts parameters that take
effect on the next frame. It is an **instrument**, not a document editor: the
work is the running scene, and the chrome exists to drive it without ever
stealing attention from it.

Character: dark, neutral graphite. Frosted glass chrome floating over a live
canvas. Mono numerals, wide-tracked uppercase micro-labels, hairline rules,
generous gutters and almost no borders. Restrained to the point of austerity —
one accent hue, used only to mean something.

It should read as a precision tool: an oscilloscope or a mixing desk, not a
web app. Nothing decorative, nothing playful, no gradients-for-mood, no
rounded-friendly. Density is a feature — an operator wants many parameters in
one view, not a comfortable few.

---

## Six rules

These are checkable in review. A change that breaks one is a regression.

1. **Components read roles, never primitives.** `var(--bg-surface)`, never
   `var(--ink-surface)`. Naming a primitive pins that component to one theme.
2. **One meaning per elevation.** Recessed means editable. Frost means floating
   chrome. A card that is both raised and recessed is two components wearing
   one shell.
3. **Colour is state, not decoration.** Teal = running/armed. Azure =
   externally driven. Amber = degraded. Rose = stopped/invalid/destructive.
   Nothing is tinted for emphasis alone.
4. **Separate with gutters before strokes.** A 12px gutter separates as well as
   a border and adds no weight. A hairline belongs *inside* a card, not between
   two of them.
5. **Numbers never move.** Values are mono and tabular so a changing digit
   cannot shift a column. The unit is always a separate, quieter element.
6. **Height comes from a token.** Three control heights cover the whole
   surface: 24 / 28 / 32. A one-off height means the component is doing two
   jobs.

---

## Token architecture

Three layers, strictly ordered. The ordering *is* the contract.

| Layer | Contents | Visibility |
| --- | --- | --- |
| **Primitives** | `--ink-*`, `--paper-*`, `--chalk-*`, `--slate-*`, `--teal-*` … | Private to the token file |
| **Roles** | `--bg-*`, `--text-*`, `--line-*`, `--sig-*`, `--e0…e3`, `--frost-*` | The only thing components may reference |
| **Themes** | reassign roles | A theme never re-declares a component rule |

Ground ramps are **neutral grey by construction** — no cyan or warm bias. Hue
belongs to the signal ramp only.

### Themes

Four, all built on the same frost material; only the tint changes.

- **glass** *(default)* — clear frost, the scene reads through the chrome.
- **dark** — deeper tint, for long sessions and capture.
- **light** — daylight desks and printed review. Frost *lightens*, never darkens.
- **auto** — tints toward opacity based on measured canvas brightness, to
  guarantee contrast over any backdrop.

### Frost material

```
background: var(--frost-sheen), var(--frost-grain) 0 0/128px 128px, var(--frost-tint);
background-blend-mode: normal, soft-light, normal;
backdrop-filter: var(--blur-frost);
```

A raking directional gradient (light catching one corner, falling to a dark
edge), fine SVG noise grain blended `soft-light`, and a tint. Edges carry the
thickness: crisp lit rim on the top edge, hairline all round, soft dark falloff
inside the bottom.

**Critical:** a translucent pane over a *black* region composites to a flat dark
slab — that is physics, not a bug. Glass only reads as glass where there is
light behind it to diffuse.

### Scales

- **Space** — 2px base, eight steps: 2 4 6 8 12 16 24 32
- **Radius** — control 5, card 8, panel 12, shell 16
- **Control height** — 24 / 28 / 32, no others
- **Type** — display 200wt, body/label/value 300wt, mono caps 500wt. Nothing
  renders below **8.5px**, and that floor is reserved for wide-tracked mono caps.
- **Motion** — named by what moves: `--dur-value` 70ms, `--dur-state` 130ms,
  `--dur-surface` 220ms, `--dur-layout` 380ms. Entering decelerates
  (`--ease-enter`); leaving accelerates and takes less time (`--ease-exit`).
  `prefers-reduced-motion` zeroes all of them; no animation is load-bearing.

---

## Shell

A full-bleed live canvas with floating frosted chrome inset from the edges
(32px sides, 20px bottom). A brand chip sits top-left. Everything else lives in
one dock.

### SH.01 — bottom dock *(default)*

One frosted card, 12px radius, 276px tall, spanning the viewport inset.

```
┌─────────────────────────────────────────────────────────────┐
│ INSPECTOR  SCENE  POSTFX  GRAPH …   ⌕ Search  ⌘K   ● WEBGPU 58fps CPU 41% ⋯ │  40px strip
├──────────────────┬─────────────────────┬────────────────────┤
│                  │                     │                    │
│   panel  φ²      │   panel  φ¹         │   panel  1         │  content
│                  │                     │                    │
└──────────────────┴─────────────────────┴────────────────────┘
   WEBGPU · ACESCG        SIGNAL GRAPH         PROJECT · PARAMS   foot line
```

- **Tab strip** — flush uppercase mono labels on a shared hairline. Not pills.
  Open panels are brighter and heavier; a thin underline marks position.
- **Columns land on the golden ratio** — φ² : φ¹ : 1 = 2.62 : 1.62 : 1.
  Maximum three panels per dock; opening a fourth retires the tail.
- **Status cluster** — backend · fps · CPU/GPU · sparkline · quality tier · `⋯`.
  Plain text, no container pill.

### SH.02 — side dock (left or right)

The same dock stood on its side. A two-column grid: a 424px column of chrome
plus a **54px vertical rail** spanning the full height on the leading edge.

- The rail replaces the tab strip — vertical mono labels, 2px inset accent on
  the active entry, no icons.
- Panels stack and divide the height by grow factors **1.2 / 1 / 0.85** (a
  column is not a row — the golden ratio would starve the tail).
- The command strip collapses to just the status cluster.

### Panel behaviour

- A docked panel is a **group card, not a window**. No window chrome.
- Its header **dissolves to zero layout cost** — affordances float into the
  top-right corner on hover or focus-within. Identity comes from the tab strip,
  the content itself and the foot line.
- **Collapsing returns the space** to sibling panels.
- **Three-zone tab targeting** — each tab is divided into thirds; clicking
  left / middle / right places the panel in that column. Choosing a panel and
  placing it are one gesture.
- Panels flow their content into as many columns as their width affords
  (container queries on the panel itself), so the same rule serves a wide
  bottom dock and a narrow sidebar.

---

## Controls

The **scrub cell** is the flagship. The whole row is the drag surface, the fill
*is* the value, and a hairline marks its exact position. One 26px row carries
label, binding, value and unit.

```
┌────────────────────────────────────────────┐
│ Exposure          orb-pulse        1.240 EV│   ← fill sweeps left→right
└────────────────────────────────────────────┘
```

Interaction model (shared by every value control via a framework-independent
kernel):

| Gesture | Effect |
| --- | --- |
| Drag | Scrub the value |
| Shift | ×10 precision |
| Alt | ×0.1 precision |
| Arrows | ±step |
| PageUp/Down | ×10 step |
| Home / End | min / max |
| Double-click | Type an exact value |
| Escape | Cancel, restore origin |
| Detents | Magnetise to named values |

One drag = **one undo entry** (transaction-based history). Realtime updates
bypass React entirely — the value paints through a CSS custom property and a
direct text write, so React only re-renders on gesture boundaries.

### Inventory

- **Numeric** — Slider (scrub cell), Dial, RangeSlider, NumberField
- **Choice** — Toggle (track + ON/OFF caption), Checkbox (14px square, inline
  flags), Segmented (≤4 options), Select (>4), Tabs
- **Text & files** — TextField, TextArea, SearchField, ColorField, VectorField,
  FileField, DropZone, KeyCapture
- **Instrument** — XYPad, Knob, Meter, Waveform, Envelope, GradientBar,
  CurveEditor
- **Display** — KeyValue, Progress, Badge, Sparkline, Empty
- **Composition** — PropertyRow, Section, Stack, Toolbar, Collapsible,
  ListBrowser (virtualised + fuzzy match)

**PropertyRow** is the structural unit of the inspector: label, control, unit,
status, reset, actions and message in one consistent relationship, so no panel
re-invents that arrangement.

---

## Panels

Runtime-bound views, each a self-contained tool:

| Panel | Purpose |
| --- | --- |
| Inspector | Project parameters exposed by the current project |
| Scene | Environment, camera, lighting, shadows, render, objects |
| PostFX | Post-processing stack, 44 effects, per-effect controls |
| InputFlow | Devices, live signals, semantic actions |
| Graph | Node editor over the runtime graph, live and edit modes |
| Library | Every reusable module, searchable with canonical imports |
| Console | Runtime log with severity filters |
| Telemetry | Frame profile, GPU timing, quality governor |

---

## State vocabulary

Every control carries the same states. **Colour marks state, but a word always
carries it too** — bound rows name their driver, faults carry text.

`idle` · `hover` · `dragging` · `editing` · `bound` · `warn` · `fault` ·
`disabled` · `mixed`

---

## Accessibility floor

Non-negotiable:

- Nothing renders below 8.5px, reserved for wide-tracked mono caps.
- Body and label text holds **4.5:1** against its own surface. `--text-faint` is
  for units, counts and timestamps only.
- Focus is a **two-ring token**, never removed — only restyled.
- State is never colour alone.
- Drag targets are at least **24px** tall. The scrub row is the floor, not the
  exception.
- `prefers-reduced-motion` zeroes every duration.

---

## What this system is not

- Not a document editor — no page metaphor, no infinite canvas of content.
- Not friendly-consumer — no large radii, no illustrations, no empty-state
  mascots, no purple gradients.
- Not colourful — one accent hue and three status hues, all semantic.
- Not spacious — density is the point. An operator wants twelve parameters in
  view, not four.
- Not skeuomorphic — frosted glass is a material for *chrome over live content*,
  not decoration applied everywhere.
