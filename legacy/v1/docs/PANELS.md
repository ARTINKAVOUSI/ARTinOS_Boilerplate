# Panels / UI System

The Studio shell is a real persistent panel workspace, not a fixed sidebar. Panels have IDs and remembered state, can be shown/hidden/collapsed, reordered between left/right/bottom docks, resized, floated over the viewport, moved and resized while floating, and restored/reset through the panel menu.

## Included panels

- Module Library — search/filter runtime/provider/category/capability and copy canonical imports.
- Drei / three-stdlib Provider Browser — lazy inspect/search installed provider exports and copy imports.
- Scene / Stage — scene presets, environment, camera/lens, controls, lighting/custom lights, shadows and render settings.
- Scene Tree — live Three scene hierarchy + semantic selection.
- Render / Quality — renderer metrics, output settings, screenshot/fullscreen and adaptive quality.
- PostFX — all local native effects, ordering, presets and pipeline master.
- Input / Signals — device activation, audio, webcam/advanced vision, signal recording/replay.
- Bindings / Modulation — signal→parameter mapping/remap/smoothing/curve/deadzone/mode.
- Automation — looping/non-looping parameter tracks with linear, smooth, ease, cubic, back, bounce and spring easing.
- Presets — search/apply/capture/delete user presets.
- Graph — dedicated panel with a Live mode (a generated, read-only map of the running signals, logic, parameters, scene objects and render pipeline) and an Edit mode node editor: typed ports with drag-to-connect, pan/zoom, marquee selection, searchable node palette, per-node inspector, live values on nodes and wires, diagnostics, undo/redo, duplicate/copy/paste, dependency-depth layout, templates and JSON import/export. See `GRAPH.md`.
- Project — save/load/export/import runtime state.
- ARTINOS Inspector — object transforms/material/light/camera/geometry plus params/signals/resources/quality/history.
- Three Inspector — official Three WebGPU Inspector attached to the same renderer.
- Agent API — semantic runtime snapshot/control surface.
- Telemetry — compact frame-budget, CPU/GPU, pass and memory instruments with bounded history, profile source labels and honest unavailable states.
- Console / Debug — structured runtime log.

## UI controls

The local UI kit includes Slider, RangeSlider, NumberField, Toggle, Select, Segmented, Button/IconButton, Dial, Meter, Progress, Badge, Text/TextArea/Search, Color, Vector, XYPad, Sparkline, CurveEditor, FileField, DropZone, KeyCapture and Collapsible primitives plus schema-driven `ParameterControl`.

## Visual contract

All shells, docks, rails, cards and controls share the same token/radius hierarchy. Glass mode uses transparent high-blur backdrop diffusion without a white, gray or dark color tint; borders remain low-contrast and geometry stays consistent across bottom, left and right docking. Theme changes may alter contrast tokens, not component dimensions or information architecture.
