# ARTINOS Recipes

## Start your project

Edit `src/default.project.tsx` or copy it to `src/<name>.example.tsx`. The entry discovers both filename patterns automatically. Keep renderer/input/panel infrastructure out of project content and move only proven reusable capability into `packages/*`.

## Define a parameter

```ts
runtime.parameters.ensure({
  id: 'fluid.force', label: 'Force', type: 'number',
  defaultValue: 1, min: 0, max: 5, step: .01,
  modulatable: true, automatable: true,
})
```

## Bind audio to it

```ts
runtime.bindings.add({
  id: 'bass-force', source: 'audio.bass', target: 'fluid.force',
  input: [0, 1], output: [0, 2], smooth: .15,
})
```

## Use ARTINOS scene families

```tsx
import { Environment, Camera, Controls, Lighting } from '@artinos/modules'

<Environment preset="studio" />
<Camera preset="product" />
<Controls mode="orbit" />
<Lighting preset="softbox" />
```

## Use Drei directly

```ts
import { Text, Float, useGLTF } from '@artinos/modules/drei'
```

## Use three-stdlib directly

```ts
import { GLTFLoader, MeshSurfaceSampler, GPUComputationRenderer } from '@artinos/modules/stdlib'
```

## Add native PostFX

```tsx
import { Bloom, SSGI, TRAA, Scanlines } from '@artinos/modules/postfx'

<Bloom strength={0.8} threshold={0.85} order={100}/>
<SSGI order={300}/>
<TRAA order={900}/>
<Scanlines intensity={0.15} count={480} order={1000}/>
```

## Add a frame task

```ts
return runtime.frames.add({
  id: 'my-simulation', phase: 'simulation', priority: 0,
  run: ({ delta }) => simulation.step(delta),
})
```

A thrown task is isolated and logged by the runtime.

## Read realtime data without React-frame state

In R3F `useFrame`, read `runtime.signals.get('audio.bass')` or `runtime.parameters.get('fluid.force')`. Use React subscriptions/polling only for UI.
