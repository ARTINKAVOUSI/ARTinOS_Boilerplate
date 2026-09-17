import type { ModuleManifest, ModuleRuntime } from '@artinos/runtime'
import { postFXCatalog } from './postfx/catalog'

const module = (
  id:string,
  name:string,
  category:string,
  description:string,
  runtime:ModuleRuntime='r3f',
  capabilities:string[]=[],
  canonicalImport='@artinos/modules',
):ModuleManifest=>({
  id,name,category,description,runtime,provider:'artinos',version:'1.3.0',capabilities,canonicalImport,
  tags:[...category.split('/'),runtime,...capabilities],
})

export const nativeModuleCatalog:ModuleManifest[]=[
  module('material.glass','Glass Material','materials','Reusable WebGPU volume transmission with RGB/spectral dispersion, frost, absorption and clean/backside captures.','r3f',['glass','transmission','spectral','webgpu'],'@artinos/modules/materials'),
  module('material.glass-mesh','Glass Mesh','materials','GlassMaterial around any geometry, with per-instance optical and physical controls.','r3f',['glass','mesh'],'@artinos/modules/materials'),
  // Scene / render families
  module('scene.stage','Scene / Stage','scene','Full scene-stage orchestration combining environment, camera, controls, lighting, shadows, fog, grid and render settings.','r3f',['webgpu','r3f','presets']),
  module('scene.environment','Environment','scene/environment','Parametric environment family: blank, clean, neutral, studio, softbox, warehouse, gallery, adaptive room, HDR, sky, outdoor, sunset and night.','r3f',['drei','hdr','presets']),
  module('scene.camera','Camera','scene/camera','Perspective/orthographic camera family with lens model and reusable view presets.','r3f',['drei','presets']),
  module('scene.controls','Controls','scene/controls','Orbit, map, trackball, fly, camera and pointer-lock control modes.','r3f',['drei','input']),
  module('scene.presentation-controls','Presentation Controls','scene/controls','Child-wrapping presentation interaction with polar, azimuth, snap and zoom constraints.','r3f',['drei','input']),
  module('scene.pivot-controls','Pivot Controls','scene/controls','Child-wrapping object pivot manipulator with translation, rotation and scale axes.','r3f',['drei','input']),
  module('scene.transform-controls','Transform Controls','scene/controls','Child-wrapping translate, rotate and scale manipulator.','r3f',['drei','input']),
  module('scene.light','Light','scene/lighting','Ambient, hemisphere, directional, point, spot, rect-area, IES-profile and probe lights with uniform visibility/layer routing. IES lights require iesUrl.','r3f',['three','shadows','ies']),
  module('scene.lighting','Lighting Rig','scene/lighting','Preset studio/product/portrait/cinematic/sun/night lighting rigs with shadow-aware lights.','r3f',['presets','shadows']),
  module('scene.shadows','Shadows','scene/shadows','Hard, soft, contact, studio and cinematic shadow system.','r3f',['drei','quality']),
  module('scene.render','Render Settings','render','WebGPU renderer exposure, tone mapping, shadow and render-quality presets.','r3f',['webgpu','quality']),
  module('scene.view','View / Multi-Viewport','scene/view','Drei View provider for multi-view, split-view and embedded viewport compositions on the shared R3F runtime.','r3f',['drei','view'],'@artinos/modules/scene'),
  module('scene.fog','Fog','scene/environment','Linear and exponential scene fog controlled by the shared parameter system.','r3f',['three','environment'],'@artinos/modules/scene'),
  module('scene.grid','Ground Grid','scene/environment','Reusable ground/grid visualization with configurable size, subdivisions, colors and fade.','r3f',['scene','debug'],'@artinos/modules/scene'),
  module('render.postfx','PostFX Pipeline','render/postfx','One ordered native TSL RenderPipeline with shared beauty/depth/normal/velocity resources and semantic effect registry.','r3f',['tsl','webgpu','mrt'],'@artinos/runtime'),
  module('content','Content','content','Unified Text, Text3D, HTML, image and billboard content family backed by Drei.','r3f',['drei','text','html']),
  module('media.plane','Media Plane','input/vision','Displays a supplied video or shared webcam resource as an R3F plane.','r3f',['vision','video','resource']),
  module('materials.glass','Glass / Transmission Material','materials','Physically-shaded refractive glass for WebGPU: TSL volume refraction, chromatic and spectral dispersion, Beer-Lambert attenuation and an optional backside pass over a multi-pass screen-space backdrop.','r3f',['tsl','webgpu','transmission','refraction'],'@artinos/modules/materials'),
  module('objects.glass-rings','Glass Rings','objects','Interlocking glass torus and orbiting metal band — the reference object for judging refraction, dispersion and the backside pass.','r3f',['transmission','gltf','showcase'],'@artinos/modules/materials'),
  module('visual.reactive-orb','Reactive Orb','objects','Reference TSL/signal-reactive R3F visual with no private render loop.','r3f',['signal','audio','tsl']),
  module('visual.signal-particles','Signal Particles','simulation/particles','Reusable realtime particle field driven by any ARTINOS signal.','r3f',['signal','particles']),

  // Semantic runtime systems
  module('runtime.parameters','Parameter Registry','runtime/parameters','Typed controllable state shared by panels, presets, automation, graph, signals and agents.','headless',['state','schema','history'],'@artinos/runtime'),
  module('runtime.signals','Signal Registry','runtime/signals','Realtime signal bus with timestamps, history and subscriptions for pointer, audio, vision, MIDI and derived data.','headless',['realtime','history'],'@artinos/runtime'),
  module('runtime.bindings','Binding / Modulation','runtime/modulation','Composable add/replace/multiply signal-to-parameter modulation with remap, smoothing, curves, deadzone and clamp.','headless',['signals','parameters','modulation'],'@artinos/runtime'),
  module('runtime.automation','Automation','runtime/automation','Keyframe automation tracks with easing, looping, speed and parameter resolution.','headless',['timeline','parameters'],'@artinos/runtime'),
  module('runtime.presets','Preset Registry','runtime/presets','Capture, store and apply named parameter collections for scenes, effects and projects.','headless',['parameters','persistence'],'@artinos/runtime'),
  module('runtime.resources','Resource Registry','runtime/resources','Semantic registry for renderer, scene, camera, media, render buffers, graph engines and arbitrary runtime resources.','headless',['gpu','assets','semantic'],'@artinos/runtime'),
  module('runtime.telemetry','Telemetry','runtime/telemetry','Cross-cutting runtime metrics for frame, renderer, PostFX, input, quality, resources and errors.','headless',['performance','debug'],'@artinos/runtime'),
  module('runtime.quality','Adaptive Quality','runtime/quality','Shared quality policy and consumers for DPR, simulations, effects, vision and other expensive systems.','headless',['performance','adaptive'],'@artinos/runtime'),
  module('runtime.persistence','Project Persistence','runtime/persistence','Runtime snapshot save/load, JSON import/export and debounced local autosave.','headless',['project','serialization'],'@artinos/runtime'),
  module('runtime.history','History','runtime/history','Undo/redo history for semantic parameter edits.','headless',['undo','redo'],'@artinos/runtime'),
  module('runtime.logger','Runtime Logger','runtime/debug','Structured info/warn/error logging consumed by the Console and Agent APIs.','headless',['console','debug'],'@artinos/runtime'),
  module('runtime.scheduler','Frame Coordinator','runtime/scheduler','Fault-isolated ordered frame phases for input, signals, parameters, simulation, compute, render and telemetry.','headless',['scheduler','fault-isolation'],'@artinos/runtime'),

  // Input systems
  module('input.system','Input System','input','Unified permission-safe browser input provider feeding ARTINOS signals.','headless',['pointer','keyboard','gamepad','audio','vision','midi','orientation'],'@artinos/inputflow'),
  module('input.audio','Audio Analyzer','input/audio','Web Audio microphone analyzer producing RMS, peak, envelope, frequency bands, beat, waveform and spectrum signals.','headless',['audio','fft','signals'],'@artinos/inputflow'),
  module('input.vision','Camera / Vision','input/vision','Webcam media resource plus luminance, average color and motion analysis signals.','headless',['webcam','vision','motion'],'@artinos/inputflow'),
  module('input.vision.advanced','Advanced Vision','input/vision','Lazy MediaPipe hand, face and pose landmarks with world-space hand/pose data, blendshapes, pinch/grab and semantic signals.','headless',['mediapipe','hands','face','pose','3d'],'@artinos/inputflow'),
  module('input.midi','Web MIDI','input/midi','Web MIDI note, CC and pitch-bend input mapped into semantic signals.','headless',['midi','signals'],'@artinos/inputflow'),
  module('input.recorder','Signal Recorder','input/recording','Record, export/import and frame-scheduled replay of realtime signal streams.','headless',['record','replay','signals'],'@artinos/inputflow'),

  // Graph / UI / inspection
  module('graph.runtime','Graph Runtime','graph','Semantic five-domain graph registry and evaluator for signal/parameter/math pipelines.','headless',['scene','signal','parameter','gpu','render'],'@artinos/graph'),
  module('ui.workspace','Panel Workspace','ui/panels','Persistent dockable/floating panel orchestration with drag/reorder, split sizing, resize, collapse, visibility and saved layouts.','headless',['panels','docking','layout'],'@artinos/ui'),
  module('ui.controls','Control Kit','ui/controls','Schema-friendly sliders, fields, toggles, selects, vectors, XY pads, meters, sparklines and control primitives.','headless',['controls','schema'],'@artinos/ui'),
  module('inspector.artinos','ARTINOS Inspector','inspector','Semantic inspector for parameters, signals, resources, history, telemetry and runtime health.','headless',['debug','semantic'],'@artinos/r3f'),
  module('inspector.three','Three.js Inspector','inspector/three','Official Three WebGPU Inspector attached to the one shared renderer with performance, memory, timeline, viewer, parameters and console tabs.','headless',['three','webgpu','debug'],'@artinos/r3f'),

  // Native TSL shared RenderPipeline effects
  ...postFXCatalog.map((effect)=>module(
    `postfx.${effect.type}`,
    effect.label,
    'render/postfx',
    `Native TSL/shared-RenderPipeline ${effect.label} effect.`,
    'r3f',
    ['tsl','webgpu',effect.cost,...(effect.requires??[])],
    '@artinos/modules/postfx',
  )),
]
