# Semantic Runtime

The semantic runtime is the reason the boilerplate's subsystems work together. `@artinos/r3f` installs a selected project into one `@artinos/runtime` instance and disposes only that project's registrations when it changes.

## Parameters

Typed schema entries provide independent base and resolved channels. Authoring UI and persistence subscribe only to base edits; direct frame consumers see every resolved change, while React snapshots are explicitly coalesced. The same definitions feed panels, presets, bindings, automation, history, graph and Agent APIs.

## Bindings / modulation

Any number of numeric signal routes can target a numeric parameter. Routes compose in insertion order with `add`, `replace` or `multiply` modes and support input/output remap, amount, offset, smoothing, deadzone, curve, inversion and clamping.

## Automation

Parameter automation supports arbitrary keyframes, loop, speed, offset and easing: linear, smooth, ease-in/out/in-out, cubic-in-out, back, bounce and damped spring.

## Persistence

A runtime snapshot contains persistable parameters, quality, bindings, automation, presets, actions, signal-processing pipelines and open-ended project state. Project state supports localStorage save/load, debounced autosave and JSON import/export. Camera views, imported environment metadata, graph definitions and scene-authoring metadata use this same transaction rather than separate storage islands.

## Resources

Renderer, scene, camera, Three Inspector, graph registry/engine, media elements, RenderPipeline and render textures are semantic named resources rather than hidden globals.

Scene and render reflection publishes bounded telemetry continuously and updates structural project-state only when the reflected pipeline changes. This avoids per-frame scene-state cloning while keeping tools and agents synchronized.

## Quality

`QualityManager` is the shared policy source. Registered consumers now include render-preset DPR, lighting shadow maps, the shared PostFX pipeline, particle draw ranges and worker vision cadence.

## Ready and agent handshake

After the first finished R3F frame, the runtime sets `data-artinos-ready=true`, publishes `runtime.ready`, dispatches `artinos:ready`, and exposes `window.__ARTINOS__.agent`. Startup exceptions are caught by `ArtinosErrorBoundary` and rendered through the compact `data-artinos-error` recovery surface.

## Telemetry / errors

Telemetry retains bounded histories for numeric metrics and supports atomic batched publication. The R3F collector samples per frame, publishes UI observations near 10 Hz and uses Three Inspector resolved frames for CPU/GPU timing when available. Runtime frame-task exceptions are caught, logged and surfaced as semantic error metrics instead of stopping unrelated tasks.
