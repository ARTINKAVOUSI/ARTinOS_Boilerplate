# ARTINOS Instrument — design system

The visual and spatial language for `@artinos/ui`. This is the **style reference**: when a
question is "what colour / size / radius / duration should this be", the answer comes from
here, not from judgement at the call site.

## Source of truth

```text
Design system premium refinement-handoff/design-system-premium-refinement/project/
├ ARTINOS System Reference v2.dc.html   the reference sheet — the canonical spec
├ artinos-instrument-tokens.css          the shipped token layer
└ support.js                             dc-runtime; renders the .dc.html prototypes
```

The `.dc.html` files are **prototypes, not production code**. Match their visual output;
don't copy their inline-style structure. `support.js` is a generated harness (it parses
`<x-dc>` / `<helmet>` and renders through React) — infrastructure, nothing to implement.

In the repo the system lives in one file: [`packages/ui/src/tokens.css`](../packages/ui/src/tokens.css),
imported by `theme.css` before any component rule.

## The three layers

Order is the contract:

```text
1. primitives   raw values          --ink-* --paper-* --chalk-* --slate-* --teal-* …
                private to tokens.css
2. roles        the only thing      --bg-* --text-* --line-* --sig-* --e0..3-* --space-* --dur-*
                components may name
3. themes       reassign roles      [data-theme="glass"|"dark"|"auto"|"light"]
                never re-declare a component rule
```

> A component rule that names a primitive pins itself to one theme. Roles are the contract;
> primitives stay private to the token file.

## The six rules

| # | Rule | In practice |
| --- | --- | --- |
| 01 | Components read roles, never primitives | `var(--bg-surface)` — not `var(--ink-surface)` |
| 02 | One meaning per elevation | recessed = editable, frost = floating chrome. A card that is both is two components |
| 03 | Colour is state, not decoration | teal = running/armed, azure = externally driven, amber = degraded, rose = stopped |
| 04 | Separate with gutters before strokes | `gap: var(--space-5)` — not a 1px border between panels |
| 05 | Numbers never move | mono + tabular so a digit change cannot shift a column; the unit is a separate, quieter element |
| 06 | Height comes from a token | 24 / 28 / 32. A one-off height means the component is doing two jobs |

## Token categories

| Category | Tokens | Notes |
| --- | --- | --- |
| Surface | `--bg-app` `--bg-stage` `--bg-surface` `--bg-raised` `--bg-hover` `--bg-active` `--bg-well` `--bg-float` `--bg-scrim` | `--bg-well` is recessed — inputs and tracks, never raised |
| Text | `--text-hi` `--text-mid` `--text-low` `--text-faint` `--text-ghost` | `--text-faint` is units/counts only (2.9:1); `--text-ghost` is disabled only |
| Edge | `--line-subtle` `--line` `--line-strong` | subtle = inside a card; line = card edge; strong = floating layer |
| Signal | `--sig-live` `--sig-warn` `--sig-fault` `--sig-bind` (+ `-hi` `-wash` `-line`) | one hue per state |
| Track | `--fill-track` `--fill-track-hover` `--tick` | the tick is the exact-value hairline |
| Elevation | `--e0-well` `--e1-surface` `--e2-dock` `--e3-float` `--focus-ring` | focus is a two-ring token, never removed — only restyled |
| Material | `--frost-tint` `--frost-sheen` `--blur-frost` `--blur-float` | frost is the dock material in **every** theme; only the tint changes |
| Space | `--space-1..8` | 2px base: 2 4 6 8 12 16 24 32. `--space-5` is the panel gutter |
| Metrics | `--control-h-sm/-/-lg` `--row-gap` `--panel-header-h` `--command-bar-h` `--tab-strip-h` `--safe-area` | three control heights, full stop |
| Radius | `--radius-control` `--radius-card` `--radius-panel` `--radius-shell` | 5 / 8 / 12 / 16 |
| Type | `--type-display/title/hero/panel/section/body/label/value/readout` `--track-caps` `--track-panel` | Chivo + Chivo Mono |
| Motion | `--dur-value/state/surface/layout` `--ease-std` `--ease-enter` | named by what moves; reduced motion zeroes all four |

## Themes

Four, all driven by `data-theme` on the workspace root — which
[`workspace-context.tsx`](../packages/ui/src/shell/workspace-context.tsx) already sets,
along with `data-backdrop` for the `auto` canvas probe.

| Theme | Character |
| --- | --- |
| `glass` | clear — blur only, no tint; text always over a local scrim |
| `dark` | frost with a deeper tint; default for long sessions and capture |
| `auto` | follows the canvas: `data-backdrop="bright"` deepens the tint, `"dark"` lifts it |
| `light` | daylight desks and printed reviews; frost lightens rather than darkens |

`[data-interacting="true"]` pins surface contrast for the duration of a pointer drag so a
dragged value never loses legibility against a moving canvas. `useControl` sets it on the
workspace root on gesture start and clears it on gesture end.

## Accessibility floor

- Nothing renders below **8.5px**, and that floor is reserved for mono caps with wide tracking.
- Body and label text hold 4.5:1 against their own surface. `--text-faint` is for units and counts only.
- Focus is a two-ring token and is never removed, only restyled.
- State is never colour alone: bound rows name their source, faults carry text.
- Drag targets are at least 24px tall — the scrub row is the floor, not the exception.
- `prefers-reduced-motion` zeroes all four durations; no animation is load-bearing.

---

## The component layer

[`packages/ui/src/instrument.css`](../packages/ui/src/instrument.css) is the reference-exact
component anatomy, transcribed from sections 05 (Components) and 06 (Patterns). It is the
**target** layer: legacy `.artinos-*` rules get deleted into it component by component.

Cascade order is enforced structurally, not by specificity:

```css
@layer legacy;               /* declares the layer first     */
@import './tokens.css';      /* roles, unlayered             */
@import './instrument.css';  /* component layer, unlayered   */
@layer legacy { … }          /* every legacy rule lives here */
```

Unlayered rules beat layered ones regardless of selector specificity, so the component layer
wins by construction and no `!important` is needed. As components migrate, rules move out of
the legacy layer and it shrinks toward nothing — that shrinkage is the progress metric for
adoption step 03.

Implemented to spec, and verified in the browser against the reference's own numbers:

| Plate | Component | Verified |
| --- | --- | --- |
| PL.03 | Scrub cell | 24px, radius 5, `1fr 84px` grid, mono tabular value, unit a separate quieter element; rest / hover / drag / bound / warn / fault |
| AS.01 | Panel card | header 36px, transparent, hairline bottom; label mono 9px/500/.22em caps; count quieter |
| PL.01 | Button | 24 / 28 / 32 heights, mono caps .18em; default / armed / ghost / danger |
| PL.02 | Segmented · Tabs | recessed well, 26px items, inset 2px accent bar — never a border |
| PL.05 | Fields | recessed `--e0-well`, 28px, two-ring focus |
| PL.06 | Status chip | 22px, 2px leading source bar, one hue per state |
| PL.07 | Progress · meter | 3px rail, signal fill |
| PL.08 | Menu · popover | `--bg-float` + `--e3-float` + `--blur-float` |
| PL.09 | Outliner row | 24px, hover / selected |
| — | Rail | vertical mono caps 8.5px/.2em, 2px inset accent |

The `bound` / `warn` / `fault` scrub states are **driven**: `ParameterRegistry` records a
write source per value, and `useParameter` derives `bound` when the resolved writer differs
from the base writer, `fault` from `setFault`. Visible live on `Orb Energy`, which the
orb-pulse graph drives.

---

## Shell — SH.01

The dock is one frosted card inset from the shell edges, with a tab strip at the head. The
console is not a bar at all — it floats bottom-right and fades when activity stops. Measured in the browser at 1440×900
against the reference's own figures:

| Measurement | Reference | Actual |
| --- | --- | --- |
| Dock inset left / right | 32px | **match** |
| Dock inset bottom | 20px | **match** |
| Dock height | 276px | **match** |
| Tab strip | 40px | **match** |
| Status line | 31px | **match** |
| Panel header | 36px | **match** |
| Scrub row | 24px | **match** |
| Panel gutter | 12px | **match** |

### The strip has four regions

`#ARTINOS` brand chip · panel tabs · search · one collapsed control. Nothing else.

- **The brand is the mark and the name.** No product suffix, no active-panel name after
  it — the tab strip already says which panel is showing.
- **The runtime HUD is not in the strip.** Frame timings are monitoring, not workspace
  chrome; `RuntimeHUD` still exists for shells that want it.
- **`DockControls` is one control, collapsed.** At rest it shows two glyphs: the selected
  dock position and a `⋯`. Hover or tab into it and it expands to the full set — three dock
  positions, three sizes, four themes, reset. Measured: **46px at rest, 317px open, 11
  buttons**. Dock layout, size and appearance were three clusters competing for strip
  width; they are one job.
- **No footer bar.** The console has something to say only when something happens, so it
  floats bottom-right beneath the dock and fades out once activity stops. Errors hold until
  something replaces them — an error that vanishes on a timer is one you can miss.

Two structural consequences of the reference, now honoured:

- **A docked panel is a group card, not a window.** Close / float / minimise chrome is
  hidden inside a dock and kept for floating panels only — the reference's panel header
  carries the name, its count and quiet affordances, nothing more.
- **The tab strip is how the dock changes what it shows**, so panel selection lives there
  rather than on each panel. The strip yields before the search field and status cluster
  do: tabs scroll, search shrinks to a floor, the status cluster holds its size.

---

## Adoption state

The reference sheet ships a five-step adoption path. Where we are:

| Step | State |
| --- | --- |
| 01 Load the token layer before theme.css | **done** — `@import './tokens.css'` is the first line of `theme.css` |
| 02 Delete the `:root` and `.plate-workspace` token blocks | **done** for the global blocks; the scoped `[data-theme]` blocks are **retained** — see *Light theme* below |
| 03 Sweep components for primitive references | **done** — 323 → 54 raw colour references |
| 04 Replace hand-set heights with the three control tokens | **done** — controls now land on 24 / 28 / 32 |
| 05 Move panel separation from borders to gutters | **done** — panels are inset cards separated by `--space-5` |

Measured against `HEAD`:

| | before | after |
| --- | --- | --- |
| raw colour references in component rules | 323 | 54 |
| distinct sub-8.5px type sizes | 3 (68 declarations) | 0 |
| distinct hand-set border radii | 15 | 4 |
| `var(--token)` references | 469 | 1146 |

Live audit (all four themes, transitions settled): **0** text nodes below the 8.5px floor.
Contrast below 4.5:1 — dark **4**, glass **4**, auto **4**; every one is `--text-faint` on a
`⌘K` hint or a `−` glyph, which is the role's documented carve-out (units, counts,
timestamps at 2.9:1). `npm run typecheck` and `npm run build` both pass clean.

### What the alias block is

`theme.css` carries a block marked `Legacy alias layer — TEMPORARY`. It maps the four
token vocabularies the file used to declare (`--panel`, `--text-primary`, `--frost-base`,
`--ui-radius-card`, …) onto roles, so the existing 194 `.artinos-*` rules keep working
while they migrate. **Do not add to it.** When the last rule referencing an alias is
migrated, delete the alias. The block is empty when step 03 is finished.

### Conflicts resolved

The reference sheet and the shipped `artinos-instrument-tokens.css` disagree in two places.
Resolution: **the sheet wins on direct contradictions, the token file wins on ranges it
already resolved.**

- **Type scale** — the sheet's type table specifies weights 200 (display), 300 (body,
  label, value) and 500 (mono caps); the token file shipped 700/600/400. `tokens.css`
  follows the sheet, because 700-weight display type contradicts the whole visual character.
- **Accessibility floor** — the sheet says nothing below 8.5px; the token file's comment
  said 10px. The sheet wins.
- **Ranges** (radius 11–13px, tab strip 34–40px, safe area 24–32px) are left at the token
  file's resolved values. The `shellSpecs` table quotes the *mock's* pixel readings (25px
  scrub row, 31px status line, 44px blur) which differ slightly from the token values
  (24 / 32 / 38) — the scale tables are token truth, `shellSpecs` is descriptive.

### Light theme — deliberate deviations

Light now measures the same as the dark themes: **0** failures attributable to the design
system. The four values below deviate from a literal reading of the reference, each because
the reference's light ramp was specified against a flat `--bg-surface` while our panels are
composited washes. All four are recorded in `tokens.css`.

| Token | Reference | Here | Why |
| --- | --- | --- | --- |
| `--text-faint` / `--text-ghost` | `slate-faint` / `#A5AEAC` | shifted up one step | Slate has four steps to chalk's five; a literal mapping put `--text-faint` at 1.7:1 |
| `--bg-row` | darkening wash | `rgba(255,255,255,.55)` | On paper a panel lifts off the ground; darkening composited ~35 points below the assumed surface |
| `--text-low` | `slate-low #5A6664` | `#46524F` | 3.9–4.5:1 on our washes; darkened just enough to clear, still clearly recessed from `--text-mid` |
| `--sig-live` / `--sig-live-hi` | `teal-700 #0B7A69` | `#075A4D` / `#064A40` | teal-700 reads 3.5–4.4:1 as *text*; the wash and line stay teal-700, since a surface is judged at 3:1 |

### Earlier light-theme analysis (superseded)

Light now composites correctly (light frost through to the row) and sits at 28 sub-4.5:1
nodes, 14 of which are native `<option>` elements the UA paints and CSS cannot reach. Two
values deviate from the reference's listing, both recorded in `tokens.css`:

- **`--text-faint` / `--text-ghost` shift up one step** (to `slate-low` / `slate-faint`).
  Slate has four steps to chalk's five, so a literal mapping put `--text-faint` at 1.7:1 —
  under even the units-and-counts allowance. Recession is preserved; only the floor moves.
- **`--bg-row` lightens instead of darkening.** On paper a panel lifts off the ground. The
  darkening wash, stacked with the dock well, composited ~35 points below the flat
  `--bg-surface` the light ramp was specified against, which pushed `--text-low` under
  4.5:1 across the whole surface.

### Earlier analysis (resolved)

`light` is the one theme that is **not** finished. It renders and is usable, but a live
audit counts ~106 text nodes below 4.5:1 (14 of them native `<option>` elements, which the
UA paints and CSS cannot fully reach).

Two things cause it, and neither is a mechanical fix:

1. **The surface stack composites differently.** The reference authored its light palette
   against a flat `--bg-surface: #F5F7F6`. Our panels are `--bg-row` over `--bg-well` over
   frost, so `--text-low` (slate `#5A6664`) and `--sig-live` (teal-700 `#0B7A69`) land
   around 4.0:1 rather than the reference's figures. The surfaces need retuning for light,
   not the text roles.
2. **The scoped `[data-theme]` blocks in `theme.css` are still load-bearing.** Adoption step
   02 says to delete them. Deleting them was tried and measurably regressed light (106 →
   190 failures), because `tokens.css` alone does not yet cover what they do for this
   component set. They stay until the components they serve are rebuilt.

Treat light as newly *enabled* rather than done — before this work `[data-theme="light"]`
had no token layer behind it at all.

### Known gaps

- **Typefaces load from Google Fonts** (`index.html`). The design specifies Chivo and Chivo
  Mono; this is an external network dependency and will fall back to the stacks in
  `--font-ui` / `--font-num` offline. Self-host if that matters.
- **Component geometry is unchanged.** The token layer restyles; it does not restructure.
  Gutters-not-borders, the 24/28/32 height discipline, the scrub-cell states
  (rest / hover / drag / bound / warn / fault) and the panel-card anatomy are component
  work, sequenced in the platform plan.
