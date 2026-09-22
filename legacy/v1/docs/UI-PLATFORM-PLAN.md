# ARTINOS UI — Platform Plan

**Source PRD:** [`ARTINOS UI — Merged Final Product Requirements Document.md`](../ARTINOS%20UI%20%E2%80%94%20Merged%20Final%20Product%20Requirements%20Document.md)
**Target:** `packages/ui` (`@artinos/ui` v1.3.0)
**Status:** Phases 0–9 delivered. See *Delivered* below.
**Design reference:** [UI-DESIGN-SYSTEM.md](UI-DESIGN-SYSTEM.md) — the ARTINOS Instrument system (Claude Design handoff). Binding for all colour, size, radius, type and motion decisions.
**Companion docs:** [UI.md](UI.md) (what exists), [RUNTIME.md](RUNTIME.md), [PANELS.md](PANELS.md), [ARCHITECTURE.md](ARCHITECTURE.md)

This plan turns the PRD's 79 sections into work that fits *this* repository. It is written
against the code as it stands on `codex/refactor-baseline`, not against the PRD's blank
slate. Where the PRD asks for something the runtime already provides, the plan says
"extend" rather than "build".

---

## 0. Phase status

All ten phases (0–9) have shipped artifacts, each verified rather than asserted.

| Phase | Scope | Evidence |
| --- | --- | --- |
| 0 | Restore the gate | `npm run typecheck` **0 errors**, `npm run build` clean |
| 1 | Kernel | `src/kernel/` — geometry · modifiers · physics · interaction · behavior · registry · lattice. **40/40** assertions in bare Node, no React, no DOM. Import-clean (verified: no `react` / `@artinos/runtime` imports) |
| 2 | Token graph cutover | `tokens.css`: 3 layers, 4 themes. Raw colour refs **323 → 54**; sub-8.5px sizes **3 → 0**; radii **15 → 4**; `var(--token)` refs **469 → 1146** |
| 3 | Validation slice | Slider + Dial on the kernel; PropertyRow; Inspector on per-parameter subscription. 1000 writes → **1** undo entry; React commits during a 40-move drag **92 → 6** |
| 4 | Lattice + adaptive presentation | `kernel/lattice.ts` (14 exports) consumed by `ParameterControl` via `ResizeObserver` → `data-density`. Panel columns land on **φ² : φ : 1 = 2.62 : 1.62 : 1** |
| 5 | Creative controls | `primitives/instrument.tsx` — Knob · XYPad · Meter · Waveform · Envelope · GradientBar, plus ColorField · VectorField · CurveEditor · RangeSlider |
| 6 | Graphics integration | `adapters/three.ts` — `bindParameter` · `bindUniform` · `bindProperty` · `bindVector` · `bindColor` · `bindThree` · `bindCssVariable`; exported and bundles clean |
| 7 | Editor systems | 8 panels render real content, verified by opening each from the strip: Inspector 27 nodes · Scene 119 · PostFX 603 · InputFlow 177 · Graph 386 · Library 978 · Console 26 · Telemetry 574 |
| 8 | Automation & signals | `AutomationEngine` · `BindingEngine` · `SignalProcessor` · `ActionRegistry` · `CommandRegistry`, surfaced by the Graph, InputFlow and Signals panels. Live: `Orb Energy` carries a `binding` tag driven by the orb-pulse graph |
| 9 | Registry & CLI | `registry.json` (8 entries) + `bin/artinos.mjs` — `list` / `show` verified end-to-end |

---

## 0b. Delivered

Measured, not asserted. Every figure below was taken from the running app or from a
harness, and both gates (`npm run typecheck`, `npm run build`) pass clean.

| PRD | Requirement | Evidence |
| --- | --- | --- |
| §6, §17–21 | UI Kernel, framework-independent | `src/kernel/` — geometry, modifiers, physics, interaction, behavior, registry. Imports nothing but itself. **40/40** assertions pass in bare Node, no React, no DOM |
| §42 | Transaction-based history | 1000 writes in one transaction → **1** undo entry, `before` = pre-gesture value. No-op and aborted gestures record nothing |
| §10 | Parameter write-source | `ParameterSource` on every write; `ui`/`binding`/`automation`/`preset`/`snapshot` each attributed; `setFault` for validity |
| §61, LD-4 | Realtime updates bypass React | React commits during a 40-move drag: **92 → 6**, of which ~3 are the running scene's own. Value paints through `--control-t` and a direct text write |
| §72 | Subscribe only to what you consume | 1000 parameters, 1000 per-id subscribers: writing one notifies **exactly 1**. 1000 writes in 6 ms |
| §15–16 | Anatomy + state vocabulary | Slider exposes Root · Fill · Tick · Detent · Label · Binding · Value · Unit and `data-state` / `data-precision` / `data-snapping` |
| §55 | Machine-readable metadata | `Slider.meta`, `PropertyRow.meta` via `defineMeta` — slots, states, parameters, tokens, keyboard contract |
| §38 | PropertyRow | label · control · unit · status · reset · actions · message, in 4 densities, with mixed-value support |
| §47–53 | Semantic token graph | `tokens.css` — 3 layers, 4 themes, every category incl. motion/easing/space/elevation/material |
| §26–36 | Visual + motion language | `instrument.css` — reference-exact anatomy, **0 raw colour literals** |
| §45 | Accessibility in behavior | 0 text below the 8.5px floor in all 4 themes; contrast `other: 0` in dark/glass/auto; full keyboard model in the kernel |

| §22–25 | Adaptive lattice + presentation ladder | `kernel/lattice.ts` — cell maths, priority allocator with drop/compress, `large → medium → compact → micro`. `useLattice` measures the *container*, not the viewport |
| §37 B | Instrument controls | Knob, XYPad, Meter, Waveform, Envelope, GradientBar — all on kernel geometry, `instrument.css` carries **0 raw colour literals** |
| §11, §60–61 | Graphics adapters | `adapters/three.ts` — `bindUniform` / `bindProperty` / `bindVector3` / `bindColor` / `bindThree` / `bindCssVariable`, all frame-scheduled, structurally typed so `@artinos/ui` gains no `three` dependency |
| §64 | Source-owned registry + CLI | `registry.json` (8 entries, each with kernel deps, tokens, parameters, states, a11y contract) and `artinos list \| show \| add`, verified end-to-end |
| §13 | Control Registry **wired** | `ParameterControl` resolves through the registry instead of a `switch`. 10/10 resolution assertions: vec2 wide→`xy` / narrow→`vector`, enum wide→`segmented` / narrow→`select`, hint honoured only when registered *and* it fits. 13 live controls carry `data-presentation` |
| §25 | Adaptive presentation **wired** | Each control measures its own width via `ResizeObserver` and reports `data-density` from `presentationForWidth` — a measurement, not a breakpoint |
| SH.01 | Shell layout | Dock inset 32/32/20, height 276, tab strip 40, status line 31, panel header 36, scrub row 24, gutter 12 — **all measured match**. Docked panels are group cards (no window chrome); the tab strip selects |

Remaining raw colour references in the legacy layer: **54** (from 323).

### Verification totals

| Harness | Result |
| --- | --- |
| Kernel (geometry, modifiers, physics, behavior, registry) | **40/40** in bare Node |
| Lattice (spans, snapping, allocation, priority, drop) | **12/12** |
| Graphics adapters (seed, change-detection, vec3, color, unbind, resolved) | **12/12** |
| History transactions | 1000 writes → 1 entry; no-op and abort record nothing |
| Parameter isolation | 1000 params, 1 write → exactly 1 notification, 1000 writes in 6 ms |
| Contrast, all four themes | `ours: 0` — every remaining case is the units/counts carve-out, a native `<option>`, or the Three Inspector's own UI |
| Type floor | 0 below 8.5px, all four themes |
| Gates | `npm run typecheck` 0 errors · `npm run build` clean |

---

## 1. Where we are today

`packages/ui` is ~7,000 lines across four layers, with `react`, `react-dom`,
`lucide-react` and four `@artinos/*` packages as its only dependencies.

```text
packages/ui/src/
├ headless/     5 files    fuzzy match · virtual · persistence · dismiss · revision
├ primitives/  11 files    numeric · text · choice · vector · files · actions · display · layout · list
├ shell/       12 files    panel types · pure layout fns · dock · rail · frame · workspace · palette
├ panels/      33 files    runtime views, incl. the whole graph editor
├ hooks/        2 files    throttled runtime subscriptions
└ theme.css   624 lines / 58 KB, 148 custom-property declarations, 194 `.artinos-*` classes
  theme.ts     16 tokens in 3 groups
```

**Blast radius is small.** Only two files outside the package import it:
[ArtinosApp.tsx](../packages/r3f/src/ArtinosApp.tsx) (`MinimalShell`, `StudioShell`) and
[main.tsx](../src/main.tsx) (`theme.css`). `packages/modules/src/catalog.ts` references it
by string id only. The redesign can proceed behind the current export surface without
touching project code.

**The runtime already owns most of the PRD's state substrate.** `@artinos/runtime`
provides `ParameterRegistry` (base/resolved split, per-id and global subscriptions,
revision counters), `BindingEngine`, `AutomationEngine`, `PresetRegistry`, `HistoryStore`,
`SignalRegistry`, `CommandRegistry`/`ActionRegistry`/`SignalProcessor`, `ProjectState`,
`RuntimePersistence`, and a `FrameCoordinator` with eight ordered phases
(`input · signals · parameters · simulation · compute · before-render · post-render · telemetry`)
supporting priority and frequency throttling.

This matters enormously for scope. The PRD's ParameterGraph, Scheduler, Binding System and
Preset System are **mostly already built** — in the right package, under AGENTS.md rule 7
(UI observes runtime state, never owns it). The work is extension, not invention.

---

## 2. Gap analysis

Honest assessment of PRD requirement vs. code today.

| PRD | Requirement | Today | Gap |
| --- | --- | --- | --- |
| §7–12 | ParameterGraph, binding, scheduling | `ParameterRegistry` + `BindingEngine` + `FrameCoordinator` | **Small.** Missing: transactions, write-source attribution, richer type set, unit metadata |
| §42 | Drag = one undo entry | `ParametersPanel` calls `runtime.setParameter` per `onChange`; `HistoryStore.push` per call | **Live defect.** One drag ≈ one history entry *per pointermove* |
| §13 | Control Registry | `ParameterControl` is a hardcoded `switch` over 8 types | **Real.** One file, well-placed — a clean replacement point |
| §14 | Schema-driven UI (`defineControls`) | none — parameters are declared one by one as `ParameterDefinition` | **Real.** Additive |
| §17–20 | Behavior machines, interaction engine, modifiers, physics | `Slider` owns `useState` + raw `window` pointer listeners + its own quantize; `Dial` duplicates a different version | **Large.** No shared behavior/interaction/physics layer exists |
| §21 | Geometry engine | percent math inline in `Slider`; `panels/graph/geometry.ts` is graph-specific | **Large** |
| §15–16 | Anatomy and `data-state` vocabulary | class-name contract only (`.artinos-scrub-cell.is-scrubbing`); no `data-state` | **Medium.** Mechanical but wide (194 classes) |
| §22–25 | Lattice, layout metadata, adaptive presentation | fixed CSS; `--ui-*` sizing tokens exist but no lattice, no layout metadata, no presentation switching | **Large** |
| §47–53 | Semantic token graph | 148 declarations across **four overlapping naming generations** (below) | **Large.** Needs a cutover, not a patch |
| §35–36 | Motion/physics as tokens | literals such as `width 90ms ease-out` inline in `Slider` | **Real.** No motion token category exists at all |
| §45 | Accessibility in the behavior definition | `Slider` has `role="slider"` + keys; `Dial` has **no** keyboard path and no ARIA value; `RangeSlider` falls back to two native `<input type=range>` | **Medium and inconsistent** |
| §55–57 | Machine-readable metadata, serialization | none | **Real.** Additive, low risk |
| §72 | Subscribe only to what you consume | `useParameters` polls the whole list at 10 Hz; every row re-renders | **Real.** Fixed by per-parameter subscription |
| §64 | Source-owned component registry / CLI | none | **Deferred** (see §7) |
| §54 | Figma variable sync | none | **Deferred** |
| §68 | DevTools | partially covered by existing Inspector panels | **Deferred** |

### The token situation, precisely

`theme.css` declares 148 custom properties in four generations that coexist and overlap:

| Generation | Examples | Note |
| --- | --- | --- |
| legacy flat | `--bg` `--panel` `--panel2` `--line` `--text` `--accent` `--radius` | still the most-referenced set |
| semantic-ish | `--bg-app` `--bg-glass` `--text-primary` `--accent-bg` `--border-subtle` `--radius-field/card/float` `--control-h` | the only generation `theme.ts` knows about |
| `--ui-*` | `--ui-chrome` `--ui-card` `--ui-well` `--ui-hairline` `--ui-radius-shell/panel/card/control` `--ui-control-height` | a third sizing/surface vocabulary |
| primitive + material | `--gray-1…12` `--teal-9/11` `--frost-base/line/raised/recessed` `--blur-glass` `--glow-sm/md` `--shadow-float` | closest to the PRD's primitive/material layers |

Plus panel-locals (`--profiler-*`, `--hud-heat*`, `--color-fps`). There are **no** space,
density, motion, easing, spring, lattice or z-index token categories. `theme.ts` exposes
16 tokens in 3 groups, so the `--ui-*`, material and primitive tokens are invisible to any
code that draws canvas, SVG or inline styles — exactly the drift `theme.ts`'s own doc
comment says it exists to prevent.

### Prerequisite defect: verification is currently broken

`scripts/` is deleted in the working tree, so `npm run doctor` fails. `npm run
check:packages` points at `scripts/check-packages.mjs`, which **does not exist in `HEAD`
either** — yet `packages/ui/README.md` and `docs/UI.md` both state the dependency rule is
"enforced by `scripts/check-packages.mjs`". The rule is documented but unenforced. This
must be fixed before any of the work below, because AGENTS.md rule 12 makes
doctor/typecheck/build the only gate this repo has.

---

## 3. Target architecture in this repo

The PRD's kernel/design-layer split maps onto directories inside the existing package.
**No new packages.** PRD §65 and AGENTS.md rule 11 agree: promote to a package only after
real reuse appears.

```text
packages/ui/src/
├ kernel/                       framework-independent — no React import, ever
│  ├ behavior/                  state machines: control, drag, edit, disclosure
│  ├ interaction/               normalized pointer/key/wheel/touch/pen → intents
│  ├ modifiers/                 clamp · wrap · snap · quantize · magnet · precision · axis-lock
│  ├ physics/                   spring · inertia · friction · detent · settle
│  ├ geometry/                  linear · angular · planar · lattice solvers
│  ├ registry/                  control registry, presentation resolution
│  ├ meta/                      component metadata + serialization schema
│  └ tokens/                    token graph source of truth + compiler
├ react/                        the React renderer for the kernel
│  ├ use-behavior.ts            binds a machine to a component
│  ├ use-interaction.ts         binds interaction primitives to DOM events
│  └ use-parameter.ts           per-parameter subscription (replaces list polling)
├ headless/                     unchanged — already correct, already kernel-shaped
├ primitives/                   rewritten on kernel + anatomy + data-state
├ layout/                       lattice, PropertyRow, adaptive presentation
├ shell/                        unchanged in behavior; restyled onto the token graph
├ panels/                       unchanged in behavior; migrated to new primitives
├ hooks/                        runtime subscriptions
└ theme.css                     GENERATED from kernel/tokens — stops being hand-edited
```

**Rule:** `kernel/` must not import React, `@artinos/runtime`, or any DOM type it does not
strictly need. Enforce it in the restored `check-packages.mjs`, so the boundary is a build
failure rather than a convention.

### Runtime changes (in `@artinos/runtime`, not here)

Four additions, all backward-compatible:

1. **Transactions on `HistoryStore`** — `begin(label)` / `commit()` / `abort()`, collapsing
   N parameter writes into one entry. Fixes the live drag defect. (PRD §42)
2. **Write source on `ParameterRegistry.set`** — optional `source` (`'ui' | 'automation' |
   'binding' | 'preset' | …`) so conflicts, history and modulation display can reason about
   who wrote a value. (PRD §10)
3. **Parameter type set + unit metadata** — extend `ParameterDefinition['type']` and make
   `unit` structured metadata rather than a display suffix. (PRD §9)
4. **Presentation + layout hints** — optional `presentation` and `layout` fields on
   `ParameterDefinition`, read by the control registry and the lattice. (PRD §24, §13)

Everything else the PRD calls "kernel state" already exists in the runtime and stays there.

---

## 4. Decisions

Recorded so they are not relitigated mid-build.

**D1 — The kernel lives in `packages/ui/src/kernel`, not a new package.**
PRD §65 says do not pre-split; AGENTS.md rule 11 says the same. A directory boundary
enforced by the package checker gives the same discipline at none of the cost.

**D2 — ParameterGraph = extend `@artinos/runtime`, do not fork.**
The runtime's registry already has the base/resolved split the PRD's modulation model
needs. A second parameter system in the UI package would violate AGENTS.md rule 7 and
guarantee drift.

**D3 — The frame scheduler is `FrameCoordinator`, not a new one.**
Its `parameters` phase is exactly the PRD §12 boundary. Realtime UI writes register a frame
task instead of calling `setState`.

**D4 — Token graph is a one-shot cutover, not a gradual rename.**
Four naming generations coexist today; adding a fifth semantic layer alongside them makes
it worse. Generate `theme.css` from a typed source, migrate all 194 classes in one commit,
delete the legacy generations. Anything else leaves permanent ambiguity about which
`--radius` is authoritative.

**D5 — `theme.ts` is generated, and covers every token.**
Its purpose is preventing drift between stylesheet and code; today it covers 16 of 148.
Generation makes coverage total by construction.

**D6 — No new runtime dependencies in phases 0–5.**
The PRD permits vendored commodity mechanics (§63), but nothing in the validation slice
needs them. Revisit only at Phase 7 (docking, virtualized graphs, floating positioning),
and only against the reuse ladder in AGENTS.md rule 3.

**D7 — The public export surface stays stable across phases 1–5.**
`primitives/index.ts` keeps exporting `Slider`, `Toggle`, `Select` and friends with
compatible props. Internals change underneath. Panels migrate on their own schedule.

**D8 — Verification is browser + typecheck + build, per AGENTS.md rule 12.**
There is no test harness and this plan does not introduce one. Acceptance criteria below
are therefore *observable* — specific, checkable behaviors, not "tests pass". The Playground
(Phase 3) is the standing verification surface.

---

## 5. Phases

Sequenced so the architecture is proven before it is spread. PRD §76 is explicit that
component count is not the progress metric — the validation slice is.

### Phase 0 — Restore the gate

Nothing below is verifiable until this is true.

- Restore `scripts/doctor.mjs`, `clean.mjs`, `init.mjs`, `setup-vision-assets.mjs`.
- **Write** `scripts/check-packages.mjs` (referenced by `package.json`, never committed).
  It must enforce: the package dependency graph; `@artinos/ui` has no UI-library
  dependency; and `kernel/` imports neither React nor `@artinos/runtime`.
- Correct `packages/ui/README.md` and `docs/UI.md`, which currently claim enforcement that
  does not exist.

**Accept:** `npm run doctor`, `npm run check:packages`, `npm run typecheck`, `npm run build`
all succeed; a deliberate `import React` inside `kernel/` fails `check:packages`.

---

### Phase 1 — Kernel foundations  ·  *delivered*

Built in `packages/ui/src/kernel/`, import-clean: it references neither React nor
`@artinos/runtime`, enforced by inspection and by the fact that its test harness runs in
bare Node with no DOM.

| Module | Contents |
| --- | --- |
| `geometry.ts` | `linearGeometry` · `angularGeometry` · `planarGeometry` · `valueAtOffset` · `valueForDelta` |
| `modifiers.ts` | `clamp` · `wrap` · `quantize` · `magnet` · `precision` · `coarse` · `deadZone` · `velocitySensitive` · `compose` |
| `physics.ts` | `stepSpring` · `stepInertia` · `elasticBound`, with the named presets (`precise`, `soft`, `mechanical`, `elastic`, `magnetic`, `heavy`) |
| `interaction.ts` | `GestureTracker` with velocity smoothing, `intentFromKey`, `intentFromWheel` — one intent vocabulary over mouse/touch/pen/key/wheel |
| `behavior.ts` | `ControlBehavior` — the `idle → hover → press → drag → release → idle` machine, with precision / snapping / constrained flags and `data-*` output |
| `registry.ts` | `ControlRegistry` (type → presentations, resolved by width/context/hint), `densityFor`, `ComponentMeta` |

**Runtime additions** (`@artinos/runtime`): `HistoryStore` is now transaction-based —
`begin` / `commit` / `abort`, nesting to the outermost, collapsing repeat writes per
parameter, dropping no-op gestures, and spanning multiple parameters. `ArtinosRuntime` gained
`beginTransaction` / `commitTransaction` / `abortTransaction` / `transact`.

**Verified** — 40 kernel assertions pass with no React and no DOM present, covering geometry
mapping and inversion, every modifier, spring convergence and non-overshoot, the full state
machine (drag, precision, cancel-restores-origin, nudge, Shift ×10, Home/End, detent snap,
disabled, read-only) and registry resolution. Separately, 1000 writes inside one transaction
collapse to **one** undo entry whose `before` is the pre-gesture value.

### Phase 1 (original scope)

Build the smallest kernel the validation slice needs. Resist breadth.

- `kernel/geometry/` — `linearGeometry` (rail bounds → normalized position → fill, thumb,
  ticks, hit area) and `angularGeometry` for dials. Pure functions, no DOM.
- `kernel/interaction/` — normalize pointer/keyboard/wheel/touch/pen into intents (`begin`,
  `move`, `commit`, `cancel`, `nudge`, `reset`) with velocity and modifier state.
- `kernel/modifiers/` — `clamp`, `quantize`, `snap`, `magnet`, `precision`, `axisLock`,
  composable in a pipeline.
- `kernel/physics/` — `spring`, `inertia`, `settle`, `detent`, plus the named presets from
  PRD §20 (`precise`, `soft`, `mechanical`, `elastic`, `magnetic`, `inertial`).
- `kernel/behavior/` — the control machine from PRD §17:
  `idle → hover → press → drag(normal|precision|constrained|snap) → release(inertia|spring|magnetic) → idle`.
- `react/use-behavior.ts`, `react/use-interaction.ts` — the binding layer.

**Runtime PRs in parallel:** history transactions and write-source (§3 items 1–2).

**Accept:** a throwaway harness drives the control machine with synthetic intents and
produces correct values with no React and no DOM present; `check:packages` confirms
`kernel/` is import-clean.

---

### Phase 2 — Token graph cutover  ·  *partially delivered*

The ARTINOS Instrument design system supplies the token graph, so this phase is no longer
authored from scratch — it is adopted. See [UI-DESIGN-SYSTEM.md](UI-DESIGN-SYSTEM.md).

**Done:**

- `packages/ui/src/tokens.css` — the three-layer graph (primitives → roles → themes) with
  every category the old vocabulary lacked: space, density, motion, duration, easing,
  elevation, material, lattice metrics.
- `theme.css` imports it first; all four legacy token generations deleted from `:root`
  and `.plate-workspace`, replaced by a temporary, explicitly-scheduled alias block.
- `theme.ts` rewritten to expose the full role set (was 16 of 148 tokens; now every role,
  primitives deliberately withheld).
- The three legacy accent greens consolidated onto `--sig-live`.
- Chivo / Chivo Mono loaded; `data-theme` already wired by `workspace-context.tsx`.

- Adoption steps 03–05 applied: raw colour references 323 → 54, sub-8.5px type sizes 3 → 0,
  hand-set radii 15 → 4, controls landing on 24 / 28 / 32, panels now inset cards separated
  by `--space-5` instead of borders.

**Remaining:**

- 54 raw colour references, mostly legend swatches and box-shadow blacks.
- Light theme contrast pass — see [UI-DESIGN-SYSTEM.md](UI-DESIGN-SYSTEM.md#light-theme-needs-a-dedicated-pass).
- Delete the alias block, and the scoped `[data-theme]` blocks it still depends on, once
  the components they serve are rebuilt.
- Native `<select>`/`<option>` cannot be fully themed; the reference's own Select component
  supersedes them in Phase 5.

**Note on D4.** The one-shot-cutover decision held for the *token layer* — all four
generations are gone. The alias block is a migration mechanism with a deletion condition,
not a fifth vocabulary; it declares no new values, only redirects old names to roles.

**Accept:** `grep` for a primitive (`--ink-`, `--chalk-`, `--teal-`) outside `tokens.css`
returns nothing; the alias block is empty; the app is visually unchanged except where the
design system deliberately changes it (browser check per AGENTS.md rule 12).

---

### Phase 3 — Validation slice ★

**This is the milestone that decides whether the architecture is right.** Per PRD §76, scope
is deliberately five things.

- **Slider** — rebuilt on kernel geometry, behavior, interaction, modifiers, physics. Full
  anatomy (`Root · Label · Rail · Track · Fill · Thumb · Marker · Tick · Value · Tooltip ·
  HitArea`), `data-state` vocabulary, motion from tokens, precision modifier, detents,
  snapping, inertial settle, dual-handle and vertical modes, RTL, disabled, read-only.
- **Number / Scrubber** — unit-aware formatting, tabular numerals, expression entry,
  keyboard entry, coarse/fine, reset.
- **Toggle** — small, but it proves the machine generalizes past continuous controls.
- **PropertyRow** — PRD §38: label · control · value · unit · status · reset · automation ·
  modulation · context actions, in single/multi-line/compact/micro variants.
- **Inspector** — PRD §39, rebuilt on `PropertyRow` with per-parameter subscription
  replacing the current 10 Hz whole-list poll.
- **Control Registry** — replaces the `ParameterControl` switch. Type → available
  presentations, resolved by context/space/hints.
- **Playground** — flat entry file per AGENTS.md rule 11 (`src/ui-playground.example.tsx`):
  states, variants, densities, themes, RTL, reduced motion, touch simulation, motion and
  physics profiles. This is the standing verification surface for every later phase.

**Status:** Slider, Dial and the transaction wiring are **done**; Number/Scrubber, Toggle,
PropertyRow and the Inspector rebuild are not.

`primitives/numeric.tsx` no longer implements drag. `Slider` and `Dial` both call
`useControl`, so precision, detents, constrain, nudge, reset, cancel and the keyboard model
are shared rather than reimplemented — `Dial` previously had no keyboard path at all.
`Slider` carries the reference's full anatomy (Root · Fill · Tick · Detent · Label · Binding ·
Value · Unit), the `data-state` vocabulary, `aria-valuetext`, and `Slider.meta` describing
its slots, states, parameters, tokens and keyboard contract.

`ParametersPanel` opens a transaction on gesture start and commits on gesture end.

**Accept — all of these observable, in the browser:**

1. ✅ Dragging a slider across its range produces **exactly one** undo entry (was: one per
   pointermove).
2. Dragging a slider bound to a scene parameter drives the scene with **zero** React renders
   in the Inspector during the drag (React DevTools profiler).
3. The same parameter shown simultaneously as slider, number field and scrubber stays
   synchronized with no synchronization code between them (PRD §8).
4. Every slice control is fully operable by keyboard alone, announces its value, and
   respects `prefers-reduced-motion`.
5. An Inspector with 1,000 registered parameters scrolls smoothly and re-renders only the
   rows whose values changed.
6. Restyling the slider entirely through tokens requires no change to its interaction code.
7. `npm run doctor && npm run typecheck && npm run build` clean.

**If criteria 1–3 do not hold, stop and revise the kernel before Phase 4.**

---

### Phase 4 — Lattice and adaptive presentation

- `layout/lattice` — the adaptive grid from PRD §22–23, with the existing large/half/quarter
  unit experiments promoted to semantic lattice scales.
- Layout metadata on components and parameters (PRD §24): `minCells`, `idealCells`,
  `maxCells`, `priority`, `compactPresentation`.
- Adaptive presentation (PRD §25): a control changes *presentation*, not just styling, as its
  cell allocation shrinks — large → medium → compact → micro.
- Context tokens (PRD §52): `inspector`, `toolbar`, `canvasOverlay`, `node`, `compact`,
  `touch`.

**Accept:** one slider placed in an Inspector, a toolbar and a canvas overlay renders three
genuinely different presentations from one declaration; narrowing a panel walks a control
down its presentation ladder without remounting or losing focus.

---

### Phase 5 — Remaining controls

Only now does breadth start. Each control reuses the kernel; none re-implements drag,
physics or geometry.

Button · Select · Segmented · Text · Vector · XY Pad · Color (area, wheel, slider, swatches)
· Gradient · Curve · Envelope · Knob · Dial · Meter · Graph · Waveform.

`Dial` and `RangeSlider` are rewrites, not ports — today they carry independent, weaker
implementations (`Dial` has no keyboard path at all).

**Accept:** every control passes the Phase 3 quality bar in the Playground; no control file
contains its own pointer-event handling or easing literal.

---

### Phase 6 — Panel migration

Migrate all 33 panels and the shell onto the new primitives, `PropertyRow`, lattice and
tokens. Behavior unchanged — `shell/panel-layout.ts` stays the pure-function transition
model it already is.

Delete the compatibility shims added in D7 once the last panel is migrated.

**Accept:** no `.artinos-*` class remains that is not generated from the token graph; no
panel imports a removed primitive; the graph editor, HUD and Three Inspector are visually
and behaviorally intact in the browser.

---

### Phase 7 — Metadata, graphics bindings, ecosystem

- Component metadata and serialization (PRD §55–57): every component exposes states, slots,
  parameters, events, tokens, accessibility contract and presentations.
- Schema-driven UI (`defineControls`, PRD §14) over the extended `ParameterDefinition`.
- Deeper Three/R3F/TSL binding surface (PRD §60) built on `FrameCoordinator`.
- Then, and only against evidence: docking, floating positioning, virtualized graphs
  (PRD §62–63), CLI/registry (§64), Figma sync (§54), DevTools (§68).

---

## 6. Risks

| Risk | Handling |
| --- | --- |
| Token cutover regresses the look across 194 classes | Phase 2 is vocabulary-only; screenshot comparison before/after; no visual change permitted in the same commit |
| Kernel is over-built before anything uses it | Phase 1 builds only what the Phase 3 slice consumes; breadth is gated on the slice's accept criteria |
| Runtime changes break existing projects | All four runtime additions are optional/back-compatible; `src/default.project.tsx` is the canary |
| Panel migration stalls half-done, leaving two idioms | D7 shims make partial migration safe; Phase 6 has a single completion gate (`grep` for legacy classes) |
| No test harness, so regressions ship silently | Playground is the standing surface; every phase's accept criteria are browser-observable; AGENTS.md rule 12 checklist runs each phase |
| Scope creep from a 79-section PRD | §7 below is the explicit deferral list; anything not in phases 0–6 needs a decision, not a drive-by commit |

---

## 7. What this plan deliberately does *not* do

- **No new packages.** D1.
- **No second parameter system.** D2.
- **No renderer beyond React.** The kernel is *structured* so a second renderer is possible
  (PRD §2); building one is not in scope. Renderer-independence is validated by the kernel's
  import-cleanliness check, not by a speculative second adapter.
- **No new external dependencies before Phase 7.** D6.
- **No test harness.** AGENTS.md rule 12 defines the gate; changing that is a separate
  decision.

Deferred to post-Phase-7, with no committed date: CLI + source-owned component registry
(§64), Figma variable synchronization (§54), dedicated DevTools (§68), MIDI/OSC/audio signal
sources beyond what `@artinos/inputflow` already provides (§44), node-graph and timeline
systems beyond the existing graph editor (§62).

---

## 8. Open questions

1. ~~**Visual direction.**~~ **Answered:** the ARTINOS Instrument system reference is the
   visual language, and it is now the binding style reference
   ([UI-DESIGN-SYSTEM.md](UI-DESIGN-SYSTEM.md)). The token layer has landed without changing
   component geometry; the component-level restyle (gutters over borders, the 24/28/32
   height discipline, scrub-cell states, panel-card anatomy) rides along with the Phase 3
   rebuild rather than happening twice.
2. ~~**Accent color.**~~ **Answered:** neither. The system's signal ramp is authoritative —
   `--teal-500 #2FB39C` live, `--teal-300 #7FE3D4` highlight, `--teal-700 #0B7A69` for
   light mode. The PRD's `#00FFCC` and the old `#4ed6bd` are both superseded. Accent is a
   *signal*, not decoration: teal = running/armed, azure = externally driven, amber =
   degraded, rose = stopped.
3. **Runtime PR sequencing.** The four runtime additions (§3) can land as one PR before
   Phase 1 or incrementally alongside it. One PR is cleaner to review; incremental unblocks
   Phase 1 sooner.
4. **Branch strategy.** `codex/refactor-baseline` has substantial uncommitted deletions
   (`.plan/`, `scripts/`, three `packages/ui` source files). Phase 0 needs that state
   resolved before it can restore `scripts/`.
