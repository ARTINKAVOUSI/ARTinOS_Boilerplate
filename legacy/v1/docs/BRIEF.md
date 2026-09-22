# Motionize

**One-click living-image engine.** Drop a still, click Motionize, get a realistic interactive looping scene that preserves the original image.

Not image → generic AI video.  
**Understand → reconstruct → rig → deform → direct → simulate → composite → loop → interact.**

---

## Goals

1. One-click automatic pipeline from still to living scene.
2. Preserve original pixels. Reconstruct hidden areas only where motion will expose them.
3. Cheapest suitable representation per element: static depth mesh, image layer, deformable card, surface, mesh, skeletal mesh, volumetric effect, or real 3D model.
4. Natural deformation via continuous rigidity / flexibility / material maps, plus structural constraints (length, max stretch, joint limits, fixed roots, collisions, attachments). No rubbery or melting motion.
5. Perfect mathematical looping: motion is periodic from t=0 so start state equals end state. Not a crossfade.
6. Live interactive scene first. MP4 / export second.
7. Non-destructive per-object modifier stacks.
8. Local-first: no cloud, API key, ComfyUI, Python/CUDA, or login for the normal path. No mandatory recurring cost.

---

## Pipeline

```
Drop image
  → Scene understanding
  → 2.5D / 3D reconstruction
  → Auto-rig + deformation
  → Motion Director
  → Physics + procedural effects
  → R3F / WebGPU live render
  → Seamless loop + interaction
  → Export / live scene
```

**Primary UX:** Upload → **[ MOTIONIZE ]** → Living Scene  
**Optional:** Select object → Warp / Rig / Pin / Bone / Cage / Motion / Physics → instant live refinement

---

## Three graphs (feed the renderer)

| Graph | Answers |
|---|---|
| **SceneGraph** | What exists: objects, depth, materials, rigid/flex regions, attachments, occlusion, lighting, atmosphere, what may / must not move |
| **DeformationGraph** | How it can deform: roots, anchors, joints, cages, pins, skin weights, solvers, constraints |
| **MotionGraph** | How it moves: behaviors, forces, drivers, frequencies, loop phase |

---

## Core systems

**Scene intelligence** — auto-build the SceneGraph from the still.

**Hybrid reconstruction** — keep original pixels; pick the cheapest representation that can support the planned motion.

**Unified deformation engine** — puppet warp, pins, cages, lattices/FFD, curves/splines, warp brushes, skeletons, skinning, soft-body-style, GPU mesh deform. Same engine across images, 2.5D layers, meshes, and 3D models.

**Smart auto-rig** — infer root, anchors, joints, hierarchy, skin weights, rigidity, and the right solver per object. A branch, curtain, floating leaf, person, cloth, hair, and rigid structure each get a different rig.

**Layered motion** — macro skeletal + meso puppet/mesh + micro shader. Example: branch sway → twig inertia → leaf flutter.

**Motion Director** — decides what moves, how much, at what frequency, under what forces, and what stays still. Assigns wind, buoyancy, cloth, surface drift, water ripples, smoke, particles, light variation, camera parallax.

**Composable drivers** — wind, springs, gravity, inertia, damping, turbulence, flow fields, buoyancy, drag, vortex, attractors, collisions, audio, mouse, touch, pen, gyro, timeline, procedural signals, AI trajectories.

**Specialized effects** — water: ripples, reflection distortion, refraction, caustics, floating objects, interactive surface. Atmosphere, used with restraint: dust, pollen, fog, mist, bokeh, volumetric light, DOF, motion blur, subtle lighting.

**Loop stabilizer** — wind, deformation, water, particles, light, and camera share loop-aware timing so the cycle is closed mathematically.

**Modifier stack** (per object) — Base → Auto Rig → Puppet Warp → Cage → Bend → Wind → Secondary Motion → Noise → Loop Stabilizer. Enable/disable, mask, reorder, blend, animate, preset.

---

## Stack

React + R3F + Three.js + WebGPU/TSL  
GPU deformation, particles, effects  
Browser ML: Transformers.js / ONNX / Web Workers  
Local processing by default  
Generative video: optional, last resort, only for motion procedural deformation cannot handle cleanly

**References (components, not a monolith):** Parallax-Maker, DepthFlow, WebSAM, browser depth tools, controllable video models.
