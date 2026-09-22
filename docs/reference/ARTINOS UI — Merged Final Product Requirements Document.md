# \# ARTINOS UI — Merged Master Specification  

# \# Kernel · Parameter Platform · Frosted-Stone Design Language · Command Center

# 

# \*\*Status:\*\* Final merged architecture, product direction, and visual/interaction contract  

# \*\*Product type:\*\* Next-generation UI operating system — component platform, interaction framework, design language, and creative-tool chrome  

# \*\*Primary target:\*\* Advanced creative software, visual editors, AI tools, WebGL/WebGPU applications, R3F/Three.js studios, dashboards, node editors, audiovisual tools, developer tools, spatial interfaces, experimental interaction systems

# 

# \*\*Read this entire document before implementing. This is one product, not two specs stapled together.\*\*

# 

# \---

# 

# \## 0. What this merge is

# 

# Two documents defined complementary halves of the same system:

# 

# | Source | What it owns in the merge |

# |---|---|

# | \*\*ARTINOS UI PRD\*\* | Kernel, ParameterGraph, behavior/geometry/presentation split, registries, tokens-as-graph, accessibility, R3F/TSL bindings, serialization, AI-native metadata, implementation order, source ownership |

# | \*\*Frosted Stone / Next-Gen Leva spec\*\* | Instrument visual language, six \*design worlds\* (not palettes), Command Center, adaptive side-panel ↔ bottom-dock, slider taxonomy, motion/physics emotional arc, showcase page, realtime self-tweaking |

# 

# \*\*ARTINOS is the platform. Frosted Stone is the first complete Design Layer — the identity people see.\*\*  

# Leva is a \*capability reference\* (schema → inspector, compact realtime controls). It is \*\*not\*\* the architecture, the public API, or the look.

# 

# The user should be able to build anything from a micro slider to a full creative application from the same primitives, and the first flagship surface should feel like \*\*Leva evolved several generations forward\*\* — instrument-grade, frosted stone/glass, physically expressive, fully self-inspecting.

# 

# \---

# 

# \## 1. Product vision

# 

# ARTINOS UI is \*\*not\*\* another themed component library.

# 

# It is a \*\*UI operating system\*\* for sophisticated creative and professional interfaces, combining:

# 

# \- beautiful, high-end, \*owned\* visual design (Frosted Stone + five sibling worlds)

# \- tactile, mechanically believable interaction

# \- reusable accessible behaviors

# \- parametric / schema-driven controls

# \- high-frequency realtime state (R3F / Three / TSL / WebGPU / audio / telemetry)

# \- adaptive spatial layout (lattice + dock morph)

# \- semantic design tokens

# \- motion and physics as first-class design primitives

# \- machine-readable component definitions

# \- strong React integration with React as \*\*a renderer, not the architecture\*\*

# \- direct R3F / Three.js / TSL integration

# \- extensibility for future renderers

# \- source ownership and deep customizability

# 

# The system must feel closer to a \*\*high-end physical instrument, professional editing application, or precision design tool\*\* than a website UI kit.

# 

# \*\*Emotional / quality arc (locked):\*\*  

# \*\*quiet / luxurious at rest → optically alive on approach → tactile on contact → expressive during manipulation → intelligent during work → kinetic during movement → precise during adjustment → calm after release.\*\*

# 

# \---

# 

# \## 2. North-star principle

# 

# \*\*Behavior, state, geometry, presentation, layout, and rendering are separable.\*\*

# 

# A component is \*\*not\*\* “a React component.” It is a structured definition of:

# 

# state · behavior · geometry · interaction · accessibility · parameters · slots · layout · tokens · motion · physics · semantics · serialization

# 

# React is the \*\*first renderer\*\* of this system, not the architecture itself.

# 

# This is what allows one roughness value to be a slider, a knob, a scrubber, a HUD chip, an XY handle, an automation lane, or a spatial gizmo — \*\*without a sync layer\*\* — and what allows six visually distinct theme \*worlds\* to share one behavior kernel.

# 

# \### Architectural thesis

# 

# Do \*\*not\*\* begin from Leva, Tweakpane, shadcn, Radix, Base UI, React Aria, Zag, or any other library as the product architecture.

# 

# Those systems may supply \*\*commodity mechanics\*\* behind adapters. ARTINOS owns semantics, geometry, interaction language, parameters, tokens, design, adaptive behavior, metadata, and composition.

# 

# ```

# &#x20;                        ARTINOS UI

# &#x20;                           │

# &#x20;          ┌────────────────┴────────────────┐

# &#x20;          │                                 │

# &#x20;      UI KERNEL                       DESIGN LAYER

# &#x20;  framework-independent          Frosted Stone + worlds

# &#x20;          │                                 │

# &#x20;   ┌──────┼──────────┐             ┌────────┼─────────┐

# &#x20;   │      │          │             │        │         │

# &#x20;State  Geometry  Interaction     Tokens   Layout   Motion

# &#x20;   │      │          │             │        │         │

# &#x20;Parameters Physics  A11y         Materials Lattice  Physics

# &#x20;   └──────┴──────────┘             └────────┴─────────┘

# &#x20;          │                                 │

# &#x20;          └──────────────┬──────────────────┘

# &#x20;                         │

# &#x20;                   COMPONENT MODEL

# &#x20;                         │

# &#x20;      ┌──────────────────┼───────────────────┐

# &#x20;      │                  │                   │

# &#x20;  Primitive           Control            Composite

# &#x20;  (a11y atoms)      (instruments)     (Inspector, dock,

# &#x20;                                      Command Center,

# &#x20;                                      Timeline, Nodes)

# &#x20;      │                  │                   │

# &#x20;      └──────────────────┼───────────────────┘

# &#x20;                         │

# &#x20;                  RENDER ADAPTERS

# &#x20;                         │

# &#x20;                 ┌───────┴────────┐

# &#x20;                 │                │

# &#x20;               React          future

# &#x20;                 │

# &#x20;          ┌──────┴────────┐

# &#x20;          │               │

# &#x20;       DOM/SVG      R3F / Three / TSL

# ```

# 

# Conceptual boundary (TypeScript shape may evolve; the split is locked):

# 

# ```ts

# interface ComponentDefinition {

# &#x20; state: unknown

# &#x20; events: unknown

# &#x20; transitions: unknown

# &#x20; constraints: unknown

# &#x20; geometry: unknown

# &#x20; interactions: unknown

# &#x20; accessibility: unknown

# &#x20; semantics: unknown

# &#x20; slots: unknown

# &#x20; tokens: unknown

# &#x20; animation: unknown

# &#x20; serialization: unknown

# &#x20; metadata: unknown

# }

# ```

# 

# \*\*Working philosophy\*\*

# 

# ```

# External libraries

# &#x20;     ↓

# solve expensive commodity mechanics

# &#x20;     ↓

# ARTINOS adapters / internal integration

# &#x20;     ↓

# ARTINOS component model

# &#x20;     ↓

# ARTINOS behavior + parameter + geometry + interaction language

# &#x20;     ↓

# ARTINOS visual / spatial / motion language  (Frosted Stone worlds)

# &#x20;     ↓

# React renderer and future renderers

# ```

# 

# \---

# 

# \## 3. Primary product goals

# 

# \*\*G1 — Exceptional visual identity\*\*  

# Intentional, distinctive, premium, contemporary, subtle, non-generic. Must not resemble Bootstrap, Material, default shadcn/Radix/Leva/Tweakpane, or standard SaaS dashboards. The look \*\*belongs to ARTINOS\*\*.

# 

# \*\*G2 — Exceptional interaction quality\*\*  

# Weight, resistance, momentum, precision, direction, snapping, constraint, hierarchy, state. Alive without becoming decorative.

# 

# \*\*G3 — Extreme composability\*\*  

# Primitives → controls → property rows → inspectors → toolbars → editors → timelines → graphs → node systems → full workspaces, without duplicating logic.

# 

# \*\*G4 — Parameter-first\*\*  

# A slider does not own a value. The UI is a presentation/manipulation surface for a \*\*parameter\*\*.

# 

# \*\*G5 — High-performance realtime\*\*  

# Comfortable with R3F, Three, WebGPU, TSL, shader uniforms, procedural systems, animation, simulations, realtime audio, pointer streams, telemetry — \*\*without React rerenders on every high-frequency tick\*\*.

# 

# \*\*G6 — Adaptive UI\*\*  

# Space, container, grid density, input modality, device, zoom, context, importance, interaction mode, content, application state. Far beyond CSS breakpoints. Includes \*\*side panel ↔ bottom dock\*\* as a first-class morph.

# 

# \*\*G7 — Extensible and machine-readable\*\*  

# Components, parameters, tokens, behaviors inspectable/serializable for docs, editors, Figma, AI agents, visual builders, inspectors, plugins.

# 

# \*\*G8 — Self-hosting Command Center\*\*  

# The system’s first flagship surface \*\*is\*\* a fully featured inspector/theme manager that live-tweaks the design system itself. Schema-driven speed of Leva; architecture and look of ARTINOS.

# 

# \---

# 

# \## 4. Non-goals

# 

# ARTINOS will \*\*not\*\*:

# 

# \- clone Leva, Tweakpane, or shadcn

# \- expose the visual style of Base UI, Radix, React Aria, or other underlying libraries

# \- force all state into React or into one global store

# \- make every component configurable through hundreds of unrelated props

# \- create abstractions only for purity

# \- become decorative one-offs

# \- sacrifice usability for novelty, or performance for animation

# \- treat accessibility as an afterthought

# \- treat themes as palette swaps

# \- start by shipping hundreds of mediocre components

# 

# \---

# 

# \## 5. Locked architectural decisions

# 

# Treat as final unless implementation evidence proves otherwise:

# 

# 1\. ARTINOS owns its visual language.  

# 2\. React is a renderer, not the definition of components.  

# 3\. Parameter state exists independently from widget state.  

# 4\. Realtime parameter updates must be able to bypass React rendering.  

# 5\. Behavior, geometry, and presentation remain separable.  

# 6\. Components expose semantic anatomy.  

# 7\. One shared interaction vocabulary.  

# 8\. Physics and motion are semantic design-system primitives.  

# 9\. Layout is spatial and adaptive (lattice + dock morph).  

# 10\. Tokens form a semantic graph, not a flat variable dump.  

# 11\. Accessibility belongs inside behavior definitions.  

# 12\. Components and parameters are machine-readable and serializable.  

# 13\. External libraries solve commodity mechanics; they do not define ARTINOS.  

# 14\. One coherent project first; split packages only when boundaries are proven.  

# 15\. First milestone = a phenomenal Inspector from a \*\*small\*\* set of exceptional controls — not a catalog of average widgets.  

# 16\. No external UI library defines the architecture.  

# 17\. \*\*Parameter → Behavior → Presentation\*\* is the control model.  

# 18\. \*\*Themes are distinct design worlds\*\* inside one material family (frost / stone / glass / grain), not recolors.  

# 19\. The Command Center is a first-class product surface, not a debug drawer.  

# 20\. High-frequency graphics bindings (Three / TSL / R3F) are first-class, not an afterthought adapter.

# 

# \---

# 

# \## 6. Core architecture (two foundations)

# 

# ARTINOS = \*\*UI Kernel\*\* (framework-independent) + \*\*Design Layer\*\* (Frosted Stone worlds: visual, spatial, material, motion). They meet in the \*\*Component Model\*\*, then \*\*Renderer adapters\*\*.

# 

# Separations that must stay true:

# 

# ```

# meaningful state       ≠ visual presentation

# behavior               ≠ JSX

# geometry               ≠ CSS layout

# parameter              ≠ control widget

# interaction primitive  ≠ browser event handler

# design token           ≠ arbitrary CSS value

# component definition   ≠ renderer implementation

# theme world            ≠ color palette

# instrument chrome      ≠ parameter data

# dock mode              ≠ a different component tree

# ```

# 

# This is what lets one semantic system power compact controls, dense inspectors, spatial tools, canvas overlays, HUD instruments, and future non-DOM renderers.

# 

# \---

# 

# \## 7. UI Kernel

# 

# Framework-independent. \*\*No application-specific visuals.\*\*

# 

# Responsibilities: behavior, state, events, parameter definitions, constraints, geometry calculations, interaction processing, physics, motion definitions, component metadata, serialization, registries, scheduling.

# 

# React components \*\*consume\*\* the kernel. React lifecycle is not the definition of the component.

# 

# \### 7.1 Behavior kernel principle

# 

# Components must not each reinvent `useState` / `useEffect` / `useRef` / raw `onPointerDown` forests.

# 

# Reusable \*\*behavior machines\*\* and \*\*interaction modules\*\* encode transitions in a renderer-independent way.

# 

# Shared graph for Slider, Knob, Scrubber, XY Pad, spatial handle, etc.:

# 

# ```

# idle

# &#x20;│

# &#x20;├── hover

# &#x20;│

# &#x20;└── press

# &#x20;      │

# &#x20;      ▼

# &#x20;     drag

# &#x20;      │

# &#x20;      ├── normal

# &#x20;      ├── precision

# &#x20;      ├── constrained

# &#x20;      └── snap

# &#x20;      │

# &#x20;      ▼

# &#x20;    release

# &#x20;      │

# &#x20;      ├── inertia

# &#x20;      ├── spring

# &#x20;      └── magnetic settle

# &#x20;      │

# &#x20;      ▼

# &#x20;     idle

# ```

# 

# Frosted Stone \*\*optical sequence\*\* maps onto the same machine (see §22):  

# \*rest → proximity awareness → optical awakening → hover → contact → tactile compression → direct manipulation → velocity response → constraint/detent → release → kinetic continuation → spring settle → rest.\*

# 

# That sequence is \*\*presentation + physics personality\*\*. The machine is shared.

# 

# \---

# 

# \## 8. ParameterGraph

# 

# Primary state and control substrate.

# 

# A parameter is meaningful application state — not a React `useState` in a widget.

# 

# ```ts

# const roughness = parameter({

# &#x20; id: "material.roughness",

# &#x20; type: "number",

# &#x20; value: 0.48,

# &#x20; default: 0.5,

# &#x20; min: 0,

# &#x20; max: 1,

# &#x20; step: 0.01,

# &#x20; label: "Roughness",

# &#x20; unit: null,

# &#x20; automation: true,

# &#x20; modulatable: true,

# &#x20; persistent: true,

# })

# ```

# 

# A parameter contains or references: identity, type, current/default value, constraints, validation, metadata, formatting, parsing, reactive signal, bindings, history, persistence, automation, modulation, serialization, \*\*presentation hints\*\*.

# 

# \### 8.1 One parameter, many presentations

# 

# The same parameter may appear simultaneously as:

# 

# Slider · Knob · Dial · NumberField · Scrubber · HUD · SpatialHandle · Graph · AutomationTrack · NodeSocket · MIDI

# 

# All manipulate \*\*one\*\* state. No sync layer.

# 

# ```

# &#x20;           Slider

# &#x20;              ↕

# Knob ↔ Roughness Parameter ↔ Number Field

# &#x20;              ↕

# &#x20;        Automation Track

# &#x20;              ↕

# &#x20;            MIDI

# ```

# 

# \*\*Parameter → Behavior → Presentation\*\* is locked. Control Registry chooses presentation from type, geometry, density, modality, hints, importance — never a permanent 1:1 map of type → widget.

# 

# \### 8.2 Parameter types (first-class)

# 

# number, integer, boolean, string, enum, range  

# vec2, vec3, vec4  

# angle, distance, percentage, time, frequency  

# color, gradient  

# curve, envelope  

# matrix, quaternion  

# asset, image, texture, video, audio  

# object reference, path  

# custom / plugin types  

# 

# \*\*Units are metadata\*\*, not suffix strings.

# 

# \### 8.3 Parameter sources

# 

# UI, keyboard, pointer, touch, pen, wheel, MIDI, OSC, audio analysis, microphone, webcam, sensor, timeline, animation, LFO, expression, simulation, AI, remote network, external application.

# 

# Source identity stays available for conflict resolution, visualization, history, automation.

# 

# \### 8.4 Binding system

# 

# Direct adapters: plain object property, React, Zustand, Three `Object3D` / Material / camera / lights / renderer / post, \*\*TSL uniforms/nodes\*\*, R3F, DOM, CSS custom properties, callbacks, custom.

# 

# ```ts

# roughness.bind(material, "roughness")

# 

# bindParameter(roughness, () => node.value, (v) => { node.value = v })

# ```

# 

# \### 8.5 Scheduler

# 

# Modes: immediate, microtask, animation frame, \*\*render frame\*\*, idle, manual, debounce, throttle.

# 

# Graphics path (mandatory capability):

# 

# ```

# pointer / UI

# &#x20;     ↓

# Parameter

# &#x20;     ↓

# scheduled update

# &#x20;     ↓

# R3F frame boundary

# &#x20;     ↓

# Three / TSL / GPU

# ```

# 

# \*\*Forbidden default path for high-frequency values:\*\*

# 

# ```

# pointer → setState → React render → effect → Three update

# ```

# 

# unless React rendering is actually required (label text, layout).

# 

# \### 8.6 Control Registry

# 

# ```ts

# registerControl({

# &#x20; type: "number",

# &#x20; presentations: {

# &#x20;   slider: Slider,

# &#x20;   field: NumberField,

# &#x20;   scrubber: Scrubber,

# &#x20;   knob: Knob,

# &#x20;   dial: Dial,

# &#x20;   meter: Meter,

# &#x20;   hud: HudChip,

# &#x20; },

# })

# ```

# 

# Selection depends on type, available geometry, context, modality, preference, density, hints, importance.

# 

# \### 8.7 Schema-driven UI (Leva-class speed, ARTINOS ownership)

# 

# ```ts

# const controls = defineControls({

# &#x20; exposure: { value: 1, min: 0, max: 4 },

# &#x20; enabled: true,

# &#x20; color: "#00ffcc",

# &#x20; quality: { value: "high", options: \["low", "medium", "high"] },

# })

# ```

# 

# Infer types and presentations; allow explicit overrides. This is how the Command Center and consumer inspectors are born — \*\*not\*\* by copying Leva’s internals.

# 

# \---

# 

# \## 9. Component language — the Instrument

# 

# Every control is a self-contained \*\*instrument\*\*: a rounded rectangular surface holding label, value, track/progress, selection, icons, swatches, handles, buttons, step indicators, inline editing, units, reset, automation/keyframe, dropdowns, context actions.

# 

# \*\*All interaction and animation happens within or relative to that boundary.\*\*

# 

# Instruments compose into folders, inspector sections, docks, HUDs, and dashboards without breaking the metaphor.

# 

# Density modes (`comfortable | compact | micro`) change padding, type, hit targets — \*\*not\*\* the metaphor.

# 

# This is the Frosted Stone \*look\* of ARTINOS controls. Anatomy (next section) is the \*structure\*. They are not in conflict: the instrument \*\*is\*\* the composed anatomy inside one material boundary.

# 

# \---

# 

# \## 10. Component anatomy, states, hierarchy

# 

# \### 10.1 Semantic parts (required)

# 

# \*\*Slider\*\*

# 

# ```

# Slider

# ├ Root

# ├ Label

# ├ Rail

# ├ Track

# ├ Fill

# ├ Thumb

# ├ Marker

# ├ Tick

# ├ Value

# ├ Tooltip

# └ HitArea

# ```

# 

# \*\*Select\*\*

# 

# ```

# Select

# ├ Root

# ├ Trigger

# ├ Value

# ├ Indicator

# ├ Portal

# ├ Positioner

# ├ Popup

# ├ Group

# ├ Item

# ├ ItemIndicator

# └ Separator

# ```

# 

# Anatomy provides styling hooks, animation targets, layout flexibility, replacement, composition, machine readability.

# 

# \### 10.2 Normalized states

# 

# default, hover, focus, focus-visible, pressed, active, dragging, editing, selected, checked, indeterminate, expanded, collapsed, open, closed, disabled, readonly, loading, warning, error, success, precision, snapping, settling, \*\*proximity\*\*, \*\*mixed\*\*, \*\*modulated\*\*, \*\*animated\*\*

# 

# Exposed as semantic attributes: `data-state="dragging"`, `data-focused`, `data-precision`, `data-snapping`, `data-disabled`, `data-proximity`, …

# 

# \### 10.3 Three component categories

# 

# \*\*A. Accessible primitives\*\*  

# Button, Link, Input, TextField, Checkbox, Switch, Radio, Tabs, Accordion, Menu, ContextMenu, Dialog, Popover, Tooltip, Select, Combobox, Toast, Drawer  

# 

# Commodity a11y may use proven headless libraries \*\*behind\*\* ARTINOS APIs.

# 

# \*\*B. Instrument controls\*\* (distinctive system)  

# Slider, Range, Knob, Dial, Scrubber, NumberField  

# XY Pad, XYZ, Vector, Quaternion  

# Color Area / Wheel / Slider / Swatches  

# Gradient Editor, Curve Editor, Envelope  

# Meter, Graph, Scope, Waveform  

# Joystick, Spatial handles, Timeline handles  

# 

# \*\*C. Composite creative-tool systems\*\*  

# Inspector, Property Grid, Scene Tree, Outliner, Layer Panel, Asset Browser, Toolbar, Tool Shelf, Command Palette, Timeline, Node Graph, Profiler, Console, Parameter Panel, Preset Browser, Material Inspector, PostFX / Lighting / Camera / Input-Signal / Telemetry panels  

# \*\*Command Center\*\* (meta-inspector + Theme Manager + Appearance)  

# \*\*Dock Shell\*\* (side ↔ bottom ↔ float)

# 

# \### 10.4 PropertyRow (structural keystone)

# 

# Consistent relationship: \*\*label · control · value · unit · status · reset · automation · modulation · context actions\*\*

# 

# Modes: single row, multi-line, compact, micro, nested, grouped, responsive, lattice-aligned.

# 

# Desktop instrument row: `Label | Control | Value | Actions`  

# Compact: `Label + Value` over `Control`  

# Touch: enlarged targets, no chrome bloat

# 

# \### 10.5 Inspector (first major composite — validates the whole system)

# 

# Must support: automatic parameter generation, manual composition, sections, nested groups, search/filter, favorites, recently-changed, pinning, reset, presets, undo/redo, copy/paste values and parameters, enable/disable, context menus, compact/expanded/micro, docking, floating, popover folders, command palette (`⌘K`), automation/modulation indicators, multi-selection, mixed values, conditional visibility, read-only, debug.

# 

# Must stay visually clean with \*\*hundreds\*\* of parameters (virtualize).

# 

# \*\*Command Center\*\* is this Inspector pointed at \*\*the design system itself\*\* (tokens, themes, physics, density) \*and\* at a sample scene — same instruments, two schemas.

# 

# \---

# 

# \## 11. Interaction engine

# 

# One input system normalizes: mouse, touch, pen, keyboard, wheel, trackpad, gestures, multi-touch, pressure, velocity, focus, hover, drag, scrub, long press, double click.

# 

# Components consume \*\*primitives\*\*, not raw browser events.

# 

# \### 11.1 Modifiers (composable)

# 

# clamp, wrap, snap, quantize, magnet, precision, accelerate, decelerate, resistance, friction, inertia, spring, overshoot, recoil, dead-zone, axis-lock, velocity sensitivity

# 

# ```ts

# interaction(

# &#x20; drag.horizontal(),

# &#x20; precision({ modifier: "Alt", factor: 0.1 }),

# &#x20; magneticSnap(detents),

# &#x20; inertia(),

# &#x20; elasticBounds(),

# )

# ```

# 

# \### 11.2 Physics (UI language, not decoration)

# 

# mass, spring, damping, friction, velocity, momentum, inertia, elasticity, magnetism, detents, resistance, collision, recoil

# 

# Semantic presets: `physical.precise | soft | mechanical | elastic | magnetic | inertial`

# 

# \*\*Distinct physics per control type\*\* (not one generic spring):

# 

# \- Sliders elongate / lag with drag velocity, spring-settle on release  

# \- Toggles compress and magnetically snap  

# \- Segmented controls: physically moving indicator  

# \- Knobs: rotational inertia + detents  

# \- Dropdowns: unfold spatially from the origin instrument  

# \- Dock morph: layout-spring of the panel itself  

# \- Theme change: material interpolation, not fade-to-black  

# 

# \*\*Physics intensity\*\* is a live token (0 = optical only, 1 = full tactile) so dense debug work stays usable.

# 

# \### 11.3 Proximity \& intent

# 

# Optional pre-hover: edge highlight, surface lift, track reveal — from pointer proximity, direction, velocity. Subtle. Off under `reduced-motion` and on coarse touch (explicit state instead).

# 

# \### 11.4 Reduced motion

# 

# Preserve state communication, interaction clarity, spatial continuity. Remove overshoot, large travel, springiness, decorative motion.

# 

# \---

# 

# \## 12. Geometry engine

# 

# Interaction geometry is \*\*not\*\* JSX/CSS.

# 

# ```ts

# sliderGeometry({ bounds, value, min, max, orientation })

# ```

# 

# Returns: rail bounds, normalized position, fill bounds, thumb center, marker/tick positions, hit area, drag range.

# 

# Enables consistent behavior across DOM, SVG, Canvas, WebGL, WebGPU, future renderers.

# 

# \---

# 

# \## 13. Spatial layout — lattice + docks

# 

# The workspace is a \*\*living spatial substrate\*\*, not arbitrary rectangles.

# 

# \### 13.1 Adaptive lattice

# 

# Invisible spatial grammar. Components occupy / span / merge / subdivide / align to cells; may reveal or dissolve the grid.

# 

# Parametric: cell size, density, subdivision, gap, radius, alignment, visibility, hierarchy, compression, expansion.

# 

# Responds to: viewport, container, zoom, device, context, content, interaction, preference, panel density, importance.

# 

# Evolve large / half / quarter units into \*\*semantic lattice scales\*\*, not hardcoded pixels.

# 

# \### 13.2 Layout metadata

# 

# ```ts

# layout: {

# &#x20; minCells: \[2, 1],

# &#x20; idealCells: \[4, 1],

# &#x20; maxCells: \[8, 2],

# &#x20; expandable: true,

# &#x20; compressible: true,

# &#x20; priority: 0.8,

# &#x20; compactPresentation: "scrubber",

# }

# ```

# 

# \### 13.3 Adaptive presentation (not just CSS)

# 

# ```

# LARGE     ROUGHNESS  ━━━━━━━━━━━━●━━━━━━━━━━━━  0.52

# MEDIUM    Roughness  ━━━━━●━━━━  .52

# COMPACT   ━━━●━━ .52

# MICRO     ●

# ```

# 

# The control may \*\*choose a different presentation\*\* (slider → scrubber → HUD chip).

# 

# \### 13.4 Adaptive chrome: Side Panel ↔ Bottom Dock (locked product surface)

# 

# The Inspector / Command Center is \*\*one system, two adopted layouts\*\* — not two UIs.

# 

# | Context | Shell | Instrument row |

# |---|---|---|

# | Ultrawide | Side inspector + optional thin telemetry dock | `Label \\| Control \\| Value \\| Actions` |

# | Desktop | Side panel (L or R) | full row |

# | Laptop / short viewport | Auto \*\*bottom dock\*\* | stacked label+value / control |

# | Tablet | Bottom dock, larger targets | stacked, touch thumbs |

# | Phone | Bottom sheet; categories as chips; one folder | micro instruments, full-width controls |

# 

# \*\*Bottom dock:\*\* categories become segments / pages / swipeable rails; pinned + recently-changed rise to a persistent strip; height constrained; overflow is horizontal scroller or “more” drawer — never a squeezed unread column.

# 

# \*\*Rules\*\*

# 

# \- Breakpoints + available height + input modality drive the default.  

# \- User can pin a mode; the system still reflows \*inside\* that mode.  

# \- Transition is a \*\*layout morph\*\* (shared-element geometry where possible), not a cut.  

# \- Touch/pen: hit targets enlarge; hover-only chrome becomes explicit buttons; no visual bloat.  

# \- Same instruments must look correct in both orientations.  

# \- Pattern is \*\*general\*\*: any dashboard/panel can reflow among docked-side, docked-bottom, floating, compact.

# 

# \---

# 

# \## 14. Design Layer — Frosted Stone identity

# 

# \*\*Formula:\*\* precision instrument + soft material + spatial lattice + luminous signal

# 

# Balance: technical, calm, elegant, tactile, minimal, fluid, precise, slightly futuristic, mechanically believable, visually memorable.

# 

# \*\*Avoid:\*\* generic SaaS, heavy gaming UI, excessive cyberpunk, neon overload, flat rectangles everywhere, unnecessary outlines, large decorative gradients, random glassmorphism.

# 

# \### 14.1 Surface language

# 

# Restrained layered material, not opaque cards:

# 

# \- soft translucency, background diffusion, controlled blur  

# \- subtle border light, very restrained shadow  

# \- depth through overlap, soft internal luminosity  

# \- high material coherence  

# \- neutral enough to sit over 3D, video, images, dark and light workspaces  

# 

# \### 14.2 Material system (tokens, not a CSS blur trick)

# 

# ```

# material.clear

# material.frosted.subtle

# material.frosted.standard

# material.frosted.dense

# material.floating

# material.overlay

# material.stone.honed

# material.stone.carved

# material.optical.layered

# ```

# 

# Tokens: background opacity, backdrop blur, saturation, edge luminance, inner highlight, outer shadow, surface noise/grain, depth, transmission, stone roughness, carved recess.

# 

# \*\*Shared material family (all six worlds):\*\*  

# neutral stone, graphite, ash, chalk, fog · smoked / clear / frosted / optical glass · subtle metal edge · fine grain / micro-noise · \*\*no strongly colored glass as a base\*\* · accent only as \*\*signal\*\* (mint/teal `#00FFCC` as \*anchor\*, not a rule that everything glows teal)

# 

# Premium = optical depth, edge light, material weight, typographic discipline, physical motion — not chrome, not skeuomorphic gadgets.

# 

# \### 14.3 Color language

# 

# Default: neutral grayscale, soft graphite, charcoal, smoke, transparent white, subtle cool gray.

# 

# Accent = \*\*signal\*\*: selection, active control, focus, progress, energy, connection, motion, important realtime feedback — never decoration.

# 

# ```

# signal.primary / .soft / .muted / .glow

# signal.success | warning | error | info

# ```

# 

# \### 14.4 Typography

# 

# Neutral, compact, high-legibility, low-noise, precise. Modern grotesk. Compact labels. \*\*Tabular numerals\*\*. Hierarchy via size/weight/opacity, not color noise. Labels must not compete with the control.

# 

# \### 14.5 Numeric UI

# 

# Tabular numbers, unit-aware formatting, precision, scrubbing, keyboard + expression entry, reset, fine/coarse, min/max/step, scientific where needed. Fields may become sliders, scrubbers, dials, or direct-edit \*\*contextually\*\*.

# 

# \### 14.6 Backdrop (mandatory for frost to read)

# 

# Dynamic textured background so glass/stone transmit correctly. \*\*Per-theme mood.\*\* Slow grain/caustic/relief — never loud. Showcase stages never sit frost on a flat hex fill.

# 

# \---

# 

# \## 15. Theme system — six live-switchable \*\*worlds\*\*

# 

# Themes are \*\*not recolors\*\*. Each is a distinct design concept: structure, proportion, edge treatment, frost strategy, type texture, shadow logic, control geometry, motion personality, spatial feel.

# 

# They remain one product family (frost / glass / stone, high-end, professional, luxury) — six instruments from the same atelier.

# 

# Must remain distinguishable \*\*even in grayscale\*\* (structure and material, not hue).

# 

# Switching is instant, animated (frost, grain, edge light interpolate; layout geometry may retarget), and restyles \*\*shell + backdrop + entire page\*\*. Users can fork a theme and live-tweak tokens.

# 

# A \*\*Theme Manager\*\* lives in the Command Center (own category + `⌘K`). Categories: \*Glass, Stone, Studio, Monument, Optical\* (a theme may belong to more than one).

# 

# Each world redefines: corner/edge, elevation/shadow, control silhouette, icon/type pairing, motion timing/easing signature, ambient backdrop — \*\*same schema/behavior underneath\*\*.

# 

# \### 15.1 Clear Frost

# 

# \*\*Concept:\*\* laboratory optical plate. Almost no body — a thin refractive membrane.  

# Near-clear glass, strong transmission, hairline luminous edges, minimal shadow, airy spacing. Controls as etched lines on crystal; tracks as light-pipes.  

# \*\*Motion:\*\* light, precise, quick.  

# \*\*Mood:\*\* weightless, clinical-luxury, daylight.

# 

# \### 15.2 Smoked Dark Frost

# 

# \*\*Concept:\*\* night studio / darkroom glass.  

# Charcoal/graphite mass, smoked translucency, pale signal type, recessed tracks, dim edge glow, tighter optical noise. Teal as the only light.  

# \*\*Motion:\*\* heavier, cinematic.  

# \*\*Mood:\*\* nocturnal, focused, quiet power.

# 

# \### 15.3 Light Stone

# 

# \*\*Concept:\*\* gallery architecture — chalk, fog-gray, silver, warm white. Soft frost set into pale stone. Soft diffusion, warm metal pins. Controls inlaid in honed limestone.  

# \*\*Motion:\*\* generous, calm.  

# \*\*Mood:\*\* editorial, daylight atelier, Nordic-architectural luxury.

# 

# \### 15.4 Graphite Studio

# 

# \*\*Concept:\*\* everyday working bench. Neutral medium-dark, low-gloss stone, frost only as a \*lens\* on active controls. Slightly denser, utilitarian luxury.  

# \*\*Motion:\*\* snappy, tool-like, no-drama.  

# \*\*Mood:\*\* professional, durable, always-on.

# 

# \### 15.5 Monolithic

# 

# \*\*Concept:\*\* carved architecture. Heavy stone, recessed controls, engraved divisions, almost no transparency. Mass and shadow do the work glass does elsewhere. Frost as a thin film on interactive faces.  

# \*\*Motion:\*\* slow, deliberate, monumental.  

# \*\*Mood:\*\* tactile, brutalist-luxury, permanence.

# 

# \### 15.6 Optical Glass

# 

# \*\*Concept:\*\* layered optics. Stacked translucency, caustic-like edge response, background-dependent appearance. Cover / cavity / instrument layers. Thinner type, internal highlights, depth stacking. The \*\*hero\*\* theme.  

# \*\*Motion:\*\* fluid, elastic, living surface.  

# \*\*Mood:\*\* jewel-like, optical, high-fashion industrial.

# 

# \*\*Theme Manager requirements\*\*

# 

# \- Live switch with optical transition  

# \- Per-theme token inspector: frost blur, transmission, grain, rim light, radius scale, density, accent, type optical size, shadow mass, stone roughness, \*\*physics intensity\*\*, motion personality  

# \- “Make variant” — duplicate without destroying the six canonical worlds  

# \- Themes remain high-end frost/stone luxury; none may collapse into flat/cheap/generic UI  

# 

# \---

# 

# \## 16. Token graph

# 

# Semantic graph, not a flat CSS dump.

# 

# ```

# Primitive → Semantic → Component → State → Context

# gray.800 → surface.panel → slider.rail.surface → slider.rail.hover.surface

# ```

# 

# \*\*Categories:\*\* color, opacity, space, size, density, radius, geometry, typography, stroke/border, shadow/elevation/depth, blur/material/transmission/noise, motion/duration/easing, spring/mass/damping/friction/inertia/magnetism, grid/lattice/alignment, hit area, focus/selection, z-index/layering.

# 

# Components rarely consume primitives directly.

# 

# \*\*Semantic examples:\*\* `surface.canvas | panel | control | overlay | tooltip`, `text.primary | secondary | muted`, `signal.primary`, `border.subtle | active`, `focus.ring`, `interaction.hover | press`

# 

# \*\*Component tokens\*\* only where semantics cannot express the need: `slider.rail.height`, `slider.thumb.size`, `propertyRow.height`, `panel.blur`

# 

# \*\*Context tokens\*\* restyle without source forks: `context.inspector | toolbar | canvasOverlay | node | mobile | compact | touch`

# 

# Most resolved tokens → CSS custom properties. Physics/interaction values may stay runtime signals.

# 

# \*\*Compiler target (eventual):\*\* CSS variables, TypeScript defs, docs, Figma variables, theme manifests, component metadata — \*\*one canonical source\*\*.

# 

# Code and Figma describe the \*\*same conceptual system\*\*.

# 

# \---

# 

# \## 17. Motion language (first-class tokens)

# 

# Do not scatter `200ms ease-out`.

# 

# ```

# motion.immediate | micro | enter | exit | expand | collapse | transfer

# spring.precise | snappy | soft | heavy | elastic

# drag.precision | free | inertial

# snap.soft | mechanical | magnetic

# ```

# 

# Principles: fast enough to preserve flow; slow enough to show cause/effect; continuous during direct manipulation; interruptible; velocity-aware; context-aware; reduced when unnecessary. \*\*Animation must never delay the user.\*\*

# 

# Each theme expresses the \*\*same vocabulary\*\* with its own timing/easing personality (Monolithic = slow/heavy, Clear Frost = light/quick, Optical Glass = fluid/elastic).

# 

# Motion communicates \*\*state\*\*, not decoration. Surfaces may brighten, compress, gain edge definition, luminance, depth — never meaningless loops.

# 

# \---

# 

# \## 18. Flagship control: Slider taxonomy

# 

# The slider must \*\*not\*\* resemble the generic HTML range.

# 

# Visual intent: rail as precision groove; thumb may integrate into track; fill dimensional; detents appear during relevant interaction; value can emerge near the pointer; active region reacts to velocity; track can locally deform or illuminate; precision mode visibly changes mechanics.

# 

# Interaction: drag, press-to-position, wheel, keyboard, touch, pen, precision modifier, double-click reset, snapping, detents, continuous/discrete, range, dual handles, vertical, RTL, readonly, disabled.

# 

# \*\*Taxonomy (all real, all demonstrated):\*\*  

# standard, value, compact, giant/reference, filled, track-only, stepped, snapping, tick, magnetic, centered/bipolar, logarithmic, exponential, fine-control, velocity-sensitive, elastic, soft-limit, vertical, rotation, time, angle, opacity, temperature, white-balance, color, audio-level, frequency, histogram/distribution range.

# 

# The live Command Center should host several simultaneously so flagship quality is \*felt\*, not only documented.

# 

# \---

# 

# \## 19. Other control families (enumerate in the product)

# 

# Each with variants, states (rest, hover, active, disabled, error, mixed, preview, modulated), schema snippet, live playground:

# 

# \- \*\*Numeric / data:\*\* steppers, scrubbers, vec2/3/4, interval, expression, monitored readouts  

# \- \*\*Selection:\*\* segmented, select/dropdown, combobox, radio, checkbox, multi, chip, tree, layer list  

# \- \*\*Color:\*\* hex, RGB/HSL/HSV, alpha, swatches, palettes, gradients, temperature/WB, HDR stubs  

# \- \*\*Buttons / actions:\*\* instant, confirm, split, icon, ghost-on-glass, destructive (restrained)  

# \- \*\*Toggles:\*\* magnetic snap, ternary, lock  

# \- \*\*Knobs / dials:\*\* detents, inertia, bipolar  

# \- \*\*Spatial:\*\* XY pad, joystick, 2D gizmo handles  

# \- \*\*Time / animation:\*\* timecode, keyframe dots, loop, speed  

# \- \*\*Smart analytics:\*\* fps, frame budget, param-change heatmap, “what changed”, AI-assist stubs — as \*\*instruments\*\*, not SaaS cards  

# 

# \---

# 

# \## 20. Command Center — flagship page surface

# 

# The first thing the user sees is a \*\*working product\*\*, not a static gallery.

# 

# \### 20.1 Dual purpose

# 

# 1\. \*\*App inspector\*\* — Leva-class panel for a sample creative/WebGPU scene (camera, material, shader, animation, post, scene graph).  

# 2\. \*\*UI system inspector\*\* — live authoring of ARTINOS itself: theme world, tokens, component style, density, motion, docking, accent, frost, type, physics intensity.

# 

# Both use the same instrument language and the same ParameterGraph.

# 

# \### 20.2 Feature set (complete)

# 

# Nested/collapsible groups · search/filter (fuzzy, type, recently-changed) · favorites · recently-changed · pinned (survive collapse and dock morph) · presets (save/load/compare) · undo/redo of \*\*parameter and style\*\* edits · copy/paste values, JSON, CSS tokens, schema · enable/disable · per-instrument context menus (reset, keyframe, copy, pin, convert presentation, MIDI stub, docs) · compact/expanded/micro · `⌘K` · popover/floating/attached folders · live monitoring (graphs, sparklines, fps) as instruments

# 

# \*\*Appearance / Component Style\*\* category: theme select + fork, density, radius/padding scale, frost (blur, saturation, transmission, tint, noise, rim), stone (roughness, carved depth, grain), type (optical size, weight, tabular, contrast), motion/physics intensity, accent (signal only), per-family overrides (“all sliders use ticks”, “toggles are magnetic”).

# 

# \*\*Every change is live on the shell and on every example further down the page.\*\*

# 

# \### 20.3 Page architecture (single continuous page)

# 

# \*\*A. Live System Shell (always present)\*\*  

# Adaptive side panel ↔ bottom dock, full inspector, Theme Manager, realtime design tweaking.

# 

# \*\*B. Design System Showcase (below / beside, same instances, same theme)\*\*

# 

# 1\. Command Center (already visible)  

# 2\. \*\*Full component library\*\* — every family, \*\*all\*\* variants/states/features (not one example each)  

# 3\. \*\*Implementation examples\*\* — dashboard, shader/graphics panel, builder/editor, bound to real schemas  

# 4\. \*\*Rest of the system\*\* — token graph, materials cookbook, motion recipes, layout primitives, iconography, empty/loading/error on glass, a11y notes, theming API for a \*seventh world as a concept\*, not a palette dump  

# 

# Showcase grid reflows 12 / 8 / 4 / 1. Example players stay interactive. No horizontal page scroll; docks may scroll internally.

# 

# A sample \*\*mini-app\*\* (scene or generative canvas) is driven entirely by the inspector so the page never feels like a disconnected kit.

# 

# \---

# 

# \## 21. Presets, history, modulation, selection

# 

# \### 21.1 Presets (above raw component state)

# 

# May include parameter values, groups, partial state, layout, animation, environment, presentation preferences.

# 

# save · load · rename · duplicate · compare · favorite · tag · search · randomize · \*\*morph / interpolate\*\* · undo · export · import

# 

# \### 21.2 Undo / redo — transactional

# 

# Dragging a slider through 1,000 values = \*\*one\*\* history action.

# 

# ```

# drag start → begin transaction → many updates → drag end → commit

# ```

# 

# Grouped multi-parameter changes supported. Style edits in Command Center are first-class history.

# 

# \### 21.3 Modulation / automation (native on parameters)

# 

# keyframes, LFO, audio modulation, envelopes, expressions, links, driver parameters, external signals, procedural input.

# 

# Visual: base value + modulation range + current effective value — without clutter.

# 

# \### 21.4 Multi-editing states

# 

# single · mixed · unset · inherited · overridden · linked · animated · modulated — communicated without noise.

# 

# \### 21.5 Unified signals (eventual)

# 

# mouse, touch, pen, keyboard, gamepad, MIDI, OSC, microphone, audio FFT, webcam, face/hand, orientation, sensors, network, AI — all into ParameterGraph.

# 

# \---

# 

# \## 22. Accessibility

# 

# Part of the \*\*behavior definition\*\*, not a wrap at the end.

# 

# Semantic roles, ARIA state, keyboard, focus visibility, logical order, value announcements, SR labels, high contrast, reduced motion, touch targets, RTL, localization, disabled/readonly.

# 

# Advanced visual interactions always have a practical non-pointer equivalent where reasonable (Leva-like arrow nudge, shift-fine, alt-coarse).

# 

# \---

# 

# \## 23. React renderer \& state classes

# 

# React: render anatomy, subscribe to \*\*relevant\*\* state, connect behavior, apply tokens and semantic attributes, portals, a11y primitives.

# 

# React does \*\*not\*\* own all realtime values.

# 

# \*\*State classes (do not smash into one store):\*\*

# 

# | Class | Examples |

# |---|---|

# | Application | workspace, selection, project, panel layout, tools |

# | Parameter | visual params, realtime values, modulation |

# | Interaction | pointer, drag, gesture, hover, focus |

# | Ephemeral rendering | frame-local, simulation, telemetry |

# 

# \---

# 

# \## 24. R3F / Three.js / TSL (first-class)

# 

# Bindings: `Object3D` transform, camera, materials, lights, shadow, environment, renderer, post, \*\*TSL values\*\*, shader/sim/geometry/particle params.

# 

# ```ts

# const intensity = parameter({ value: 5, min: 0, max: 20 })

# bindThree(light, { intensity })

# ```

# 

# Inspectors appear from schemas. High-frequency path: \*\*pointer → parameter signal → frame scheduler → TSL uniform\*\*.

# 

# UI must coexist with demanding WebGPU/R3F scenes without eating the frame.

# 

# \---

# 

# \## 25. Performance requirements

# 

# \- Direct manipulation: perceived feedback \*\*immediate\*\*  

# \- High-frequency drag/scrub: no unnecessary React renders  

# \- Large inspectors: thousands of properties via virtualization  

# \- Animation: transform/opacity (and other cheap paths)  

# \- Subscribe only to consumed state  

# \- GPU apps: UI must not dominate frame time  

# \- Physics intensity scalable to 0  

# 

# \---

# 

# \## 26. Machine-readable components, serialization, AI-native

# 

# ```ts

# Slider.meta = {

# &#x20; name: "Slider",

# &#x20; states: \[...],

# &#x20; slots: \[...],

# &#x20; parameters: \[...],

# &#x20; events: \[...],

# &#x20; tokens: \[...],

# &#x20; accessibility: {...},

# &#x20; presentations: \[...],

# }

# ```

# 

# Powers docs, visual builders, inspectors, AI agents, automatic property panels, design tooling, testing, serialization.

# 

# Semantic JSON, not implementation junk:

# 

# ```json

# {

# &#x20; "component": "Slider",

# &#x20; "parameter": "material.roughness",

# &#x20; "presentation": "tactile",

# &#x20; "layout": { "span": \[4, 1] }

# }

# ```

# 

# An agent should be able to ask: what exists, what this Inspector exposes, which controls represent a vec3, which tokens define the surface, who owns this state, what is animated, generate an inspector, replace number fields with an XY pad, create a compact toolbar — \*\*without reverse-engineering JSX\*\*.

# 

# \---

# 

# \## 27. Dependency, source ownership, packages

# 

# \*\*External libs solve commodity problems.\*\* ARTINOS owns public API, anatomy, parameters, interaction, physics, geometry, tokens, visual design, adaptive behavior, serialization, metadata.

# 

# | Problem | Strategy |

# |---|---|

# | Common a11y primitives | Wrap Base UI / equivalent behind ARTINOS APIs |

# | Complex a11y, collections, DnD | React Aria-style lower level where it reduces risk |

# | Interaction machines | Zag-style \*concepts\* or selected machines; ARTINOS contracts remain authoritative |

# | Styling | ARTINOS token graph + materials + anatomy |

# | Motion | ARTINOS semantic motion/physics; mature engine optional underneath |

# | State | Small focused stores/signals by responsibility |

# | Huge lists | Dedicated virtualization |

# | Floating UI | Dedicated positioning |

# | Docking | Dedicated docking engine \*\*skinned and driven by ARTINOS dock morph\*\* |

# | Node canvas | Dedicated graph engine |

# | R3F / Three / TSL | First-class ARTINOS adapters |

# 

# \*\*Source-owned registry\*\* (inspiration: shadcn distribution, \*\*not\*\* shadcn visuals):

# 

# ```

# artinos add slider

# artinos add color-picker

# artinos add inspector

# artinos add curve-editor

# ```

# 

# An installed entry can include: implementation, behavior definition, geometry, parameter compatibility, tokens, types, metadata, docs, examples, a11y contract, tests — \*\*not just copied TSX\*\*.

# 

# \*\*Do not\*\* prematurely split dozens of packages. Start:

# 

# ```

# artinos-ui/

# &#x20; core/  components/  controls/  layout/  motion/

# &#x20; tokens/  adapters/  studio/  examples/

# ```

# 

# Promote modules only after real boundaries emerge.

# 

# \*\*APIs:\*\* predictable, typed, composable, discoverable, minimal by default, powerful when expanded.

# 

# Prefer `<Slider parameter={roughness} presentation="tactile" />` over dozens of styling props. Advanced work: slots, tokens, behavior composition, variants, context, registry.

# 

# \*\*Escape hatches:\*\* custom anatomy, renderer, behavior, control, tokens, geometry, parameter type, interaction modifier, adapter — without forking the framework.

# 

# \---

# 

# \## 28. DevTools, playground, documentation, quality gate

# 

# \*\*DevTools (eventual):\*\* inspect component / parameter / token resolution / state / anatomy / events / a11y / lattice cells / performance / subscriptions / sources; live-modify; freeze; simulate states.

# 

# \*\*Playground (every component):\*\* states, variants, sizes, densities, \*\*all six theme worlds\*\*, input modalities, motion/physics profiles, RTL, high contrast, reduced motion, touch simulation, parameter values. This \*is\* development + visual documentation.

# 

# \*\*Docs\*\* generated partly from metadata: purpose, anatomy, examples, API, states, a11y, tokens, behavior, keyboard, interaction, adaptive presentations, parameter compatibility, performance.

# 

# \*\*A component is not complete because it renders.\*\* It must be visually polished, keyboard/pointer/touch usable, SR-meaningful, RTL-ok where relevant, high-performance, adaptive, themeable across \*\*six worlds\*\*, documented, serializable, machine-readable, tested across states.

# 

# \---

# 

# \## 29. First release set \& flagship experience

# 

# \### Foundation controls (do not expand until these are exceptional)

# 

# Slider · Range Slider · Number/Scrubber · Toggle · Checkbox · Button · Select · Segmented Control · Text Input · Color Control · Vector Control · XY Pad  

# 

# \### Composition

# 

# PropertyRow · Section · Panel · \*\*Inspector\*\* · Toolbar · Tabs · Popover · Tooltip · Context Menu · \*\*Dock Shell\*\* · \*\*Theme Manager\*\*

# 

# \### Infrastructure

# 

# Parameter · ParameterGraph · ControlRegistry · Behavior · Interaction Engine · Token Runtime · Layout/Lattice · Motion/Physics · React bindings · Three/R3F bindings

# 

# \### First flagship demo (proves the merge)

# 

# A \*\*single continuous page\*\*: Command Center (side ↔ bottom dock) live-tweaking \*\*six theme worlds\*\* + tokens + physics, driving a high-end R3F/WebGPU scene (lighting, materials, camera, environment, post), then the full library, implementation examples, and design-system remainder — all the same instances, same theme.

# 

# Must demonstrate: schema generation, multiple presentations of one parameter, presets, modulation indicators, adaptive layout, physics, touch, keyboard, Figma-aligned tokens, realtime TSL/Three updates \*\*without\*\* render storms.

# 

# \---

# 

# \## 30. Implementation order

# 

# \*\*Do not use component count as progress.\*\* The first milestone succeeds only when a tiny vertical slice hits intended quality \*\*and\*\* architecture end-to-end.

# 

# \### Architecture validation slice (Kernel 0.1)

# 

# ```

# Behavior + Parameter + Tokens + Interaction

# &#x20;       ↓

# Slider + Number/Scrubber + Toggle

# &#x20;       ↓

# PropertyRow → INSPECTOR

# &#x20;       ↓

# one theme world (Graphite Studio) + frost material actually transmitting a backdrop

# ```

# 

# This slice forces: state, binding, reactivity, transactions, scheduling, input (pointer/touch/pen/keyboard/focus), a11y, geometry, layout, tokens, materials, motion, physics, precision, snapping, composition, adaptive presentation, serialization, metadata, performance.

# 

# \### Phase 1 — Kernel  

# Parameter, signals, transactions, scheduler, Behavior, Interaction Engine, geometry foundations, Control Registry, token runtime

# 

# \### Phase 2 — Foundation controls  

# Exceptional Slider, Number/Scrubber, Toggle, Button, Select, PropertyRow, Section  

# \*\*Do not expand the library until these validate the architecture.\*\*

# 

# \### Phase 3 — Inspector + Dock  

# Panel, Inspector, schema inference, grouping, search, reset, presets, mixed values, conditional visibility, \*\*side ↔ bottom morph\*\*, command palette

# 

# \### Phase 4 — Design system + six worlds  

# Token graph, materials, lattice, type, color, motion, physics, density, \*\*six theme worlds + Theme Manager + live Appearance inspector\*\*, Figma convergence, backdrop stages

# 

# \### Phase 5 — Creative controls  

# Color, Gradient, Vector, XY, Knob, Dial, Curve, Envelope, Meter, Graph, Waveform — full slider taxonomy

# 

# \### Phase 6 — Graphics integration  

# Three / R3F / TSL adapters, frame scheduling, scene metadata, automatic inspectors, flagship WebGPU scene

# 

# \### Phase 7 — Showcase page remainder  

# Full library enumeration, implementation examples, analytics instruments, documentation surfaces — still live-themed

# 

# \### Phase 8 — Professional editor systems  

# Scene Tree, Asset Browser, Node Graph, Timeline, Profiler, Console, docking engine integration

# 

# \### Phase 9 — Automation and signals  

# keyframes, LFO, modulation, MIDI, OSC, audio, webcam, external signals

# 

# \### Phase 10 — Registry and ecosystem  

# CLI, component registry, plugins, docs, templates, theme packs, control packs, DevTools

# 

# \*\*Do not\*\* start with node graphs, 40 components, or a custom marketing site before the Phase 2 slider + Inspector feel like a physical instrument.  

# \*\*Do not\*\* ship six palettes and call them worlds.  

# \*\*Do not\*\* skip the dock morph.

# 

# \---

# 

# \## 31. Success criteria

# 

# ARTINOS UI succeeds when:

# 

# \- a new parameter automatically receives appropriate professional UI  

# \- the same parameter appears through multiple synchronized presentations  

# \- components can be radically restyled (including \*\*six distinct worlds\*\*) without rewriting interaction logic  

# \- components adapt intelligently to lattice space \*\*and\*\* side/bottom dock modes  

# \- sliders, knobs, pads, scrubbing feel physically precise and distinctive  

# \- R3F/Three/TSL values update without unnecessary React rendering  

# \- common a11y works by default  

# \- dark/light/material \*\*worlds\*\* change without component forks  

# \- Figma and code share token semantics  

# \- a component can describe itself to docs and AI  

# \- Inspector panels remain usable with very large parameter sets  

# \- developers add types and controls through registries  

# \- apps visibly share ARTINOS interaction + design language  

# \- the system produces both extremely minimal UIs and dense professional tooling without losing coherence  

# \- the Command Center live-authors the system and a scene at once  

# \- themes are distinguishable in grayscale and never read as recolors  

# \- the emotional arc in §1 is readable in the live shell  

# \- it reads as \*\*Leva evolved several generations forward\*\* \*and\* as an owned OS, not a Leva skin or a Radix theme  

# 

# \---

# 

# \## 32. Final product definition

# 

# \*\*ARTINOS UI\*\* is a headless, parameter-driven, physically expressive, spatially adaptive component platform with its own semantic design language — \*\*Frosted Stone and five sibling worlds\*\* — and a self-hosting Command Center.

# 

# ```

# UI Kernel

# \+ ParameterGraph

# \+ Behavior Engine

# \+ Interaction Engine

# \+ Geometry Engine

# \+ Control Registry

# \+ Adaptive Lattice + Dock Morph

# \+ Semantic Token Graph

# \+ Material System (frost / stone / optical glass)

# \+ Motion \& Physics Language

# \+ Accessible Component Anatomy

# \+ Instrument chrome

# \+ React Renderer

# \+ R3F / Three / TSL Bindings

# \+ Machine-Readable Metadata

# \+ Source-Owned Component Registry

# \+ Theme Worlds (6)

# \+ Command Center

# ```

# 

# In one sentence:

# 

# \*\*ARTINOS UI is a framework-independent behavior/parameter/interaction kernel + headless anatomical component model + token/spatial/material/motion/physics design engine + renderer ecosystem, with React as the first renderer, Frosted Stone as the first complete visual world-system, and a Leva-class schema Inspector as the first flagship composite — none of which are allowed to define the others.\*\*

# 

# The result should provide:

# 

# \- the \*\*speed\*\* of developer-panel systems (schema → UI)  

# \- the \*\*robustness and accessibility\*\* of mature primitive libraries  

# \- the \*\*flexibility\*\* of headless state-machine architectures  

# \- the \*\*visual/interaction quality\*\* of a bespoke professional creative application  

# \- \*\*six luxury frost/stone worlds\*\*, live-authored, physically distinct  

# 

# \*\*without inheriting the visual or architectural limitations of any of them.\*\*

# 

# The objective is not a better UI kit.

# 

# The objective is a \*\*unified design, interaction, parameter, and component language\*\* from which entire creative applications can be constructed — and a first page that already \*is\* one.

# 

# \---

# 

# \## 33. Non-negotiables for anyone implementing this

# 

# \- One product, one kernel, one token graph, six theme \*worlds\*.  

# \- Parameter ≠ widget. React ≠ architecture. Theme ≠ palette.  

# \- Write the Command Center as a real Inspector, not a settings mock.  

# \- Side panel and bottom dock are both first-class and auto-adaptive.  

# \- Realtime tweaking of design, components, and theme restyles the entire page.  

# \- High-frequency values must not thrash React.  

# \- Accessibility and reduced motion are in the behavior machines.  

# \- First milestone is Slider + Number + Toggle + PropertyRow + Inspector + one transmitting frost material — done at the quality bar — then expand.  

# \- Do not clone Leva/shadcn/Radix looks. Do not skip physics. Do not skip dock morph. Do not skip grayscale-distinct worlds.

# 

# \*\*Build exactly this.\*\*

