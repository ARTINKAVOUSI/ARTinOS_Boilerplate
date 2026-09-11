# Scene / Stage System

`@artinos/r3f` composes `RuntimeStage` from reusable scene modules against the shared parameter registry. Each host project supplies only its own `Content` component.

## Scene presets

14 presets ship locally: Blank, Clean, Neutral, Studio, Softbox, Product, Portrait, Warehouse, Gallery, Adaptive Room, Outdoor, Sunset, Night and Cinematic. A scene preset can alter environment, lighting, shadows, camera, exposure, render preset, fog and grid in one parameter transaction.

## Environment

The Environment family supports blank/clean/neutral/studio/softbox/warehouse/gallery/adaptive-room/HDR/sky/outdoor/sunset/night modes, background control, custom HDR/EXR URL or local file import, environment intensity/rotation/blur, ground and background color. Imported asset metadata is stored in unified project state. Adaptive Room derives its Backdrop dimensions and placement from current content bounds and viewport aspect.

## Camera and lens

Perspective and orthographic cameras share presets for front/back/top/bottom/left/right/isometric/product/portrait/wide/cinematic/macro. Controls include target, FOV, focal-length/lens conversion, lens presets, film gauge, zoom and clipping range. Named views capture and restore the live camera transform; the project stores view-layout state for single, horizontal, vertical and quad hosts.

## Controls

Orbit, Map, Trackball, Fly, CameraControls and Pointer Lock are available as the main camera-control family. Presentation, Transform and Pivot controls are exported directly for object interaction.

## Lighting and shadows

Preset rigs cover neutral/studio/softbox/product/portrait/dramatic/cinematic/sun/night. Reusable `IESLight` and `ProbeLight` components widen the WebGPU lighting family with loaded IES profiles and layer-aware probes; quality scales shadow maps through one registered consumer.

Shadow modes cover off, hard, soft, contact, studio and cinematic, with opacity/blur/size/far/samples/focus/color controls. The installed Drei alpha exposes ContactShadows/Grid only through a WebGPU barrel that imports Three's removed `WebGLCubeRenderTarget`; the boilerplate therefore retains bounded, disposable WebGPU-safe native shadow/grid textures until that upstream provider becomes build-compatible.

## Render profiles

Fast, Mobile, Balanced, High, Ultra, Cinematic, Product, Interactive, Installation and Screenshot profiles provide bounded DPR ranges. `RenderSettings` is the only DPR consumer; adaptive quality changes its scalar rather than calling the renderer independently.

The Render panel provides fullscreen and high-resolution PNG capture at 1×–4×. Capture temporarily resizes the existing renderer and restores its size and pixel ratio afterwards; it never creates a second renderer.
