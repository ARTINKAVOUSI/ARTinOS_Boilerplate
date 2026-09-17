# @artinos/r3f

Application entry and orchestrator. Owns runtime and provider composition, the single R3F
canvas, deterministic project install and dispose, stage composition, telemetry and
adaptive quality.

Depends on: every other package.

```tsx
import { ArtinosApp, type ArtinosProject } from '@artinos/r3f'

const project: ArtinosProject = {
  id: 'demo',
  name: 'Demo',
  Content: () => <mesh><boxGeometry /><meshStandardMaterial /></mesh>,
}

export const App = () => <ArtinosApp project={project} />
```

`installProject` is the single place a project is wired into the runtime — parameters,
modules, presets, bindings and graphs land there and are removed together on dispose.

## src/studio

The editor: every panel that reads the runtime, plus the two shells that arrange them.

```
studio/
  panels/       inspector, scene, postfx, graph, timeline, telemetry, console, HUD …
  hooks/        runtime subscriptions, throttled for panel rates
  adapters/     runtime → three and scene-schema bridges
  primitives/   ParameterControl — the one control bound to a parameter
  shell/        MetaBlockShell, the docking shell built on @artinos/metablock
  chrome.css    binds the MetaBlock engine's variables to the @artinos/ui tokens
  studio-panels.css  panel layout, in the artinos.studio cascade layer
```

This is the only place the ARTINOS runtime and the design system meet: `@artinos/ui` is
standalone and knows nothing about a runtime, so anything that reads `useArtinosRuntime`
lives here and composes the kit's components.

```tsx
import { definePanel, PanelWorkspace } from '@artinos/ui'
import { ParametersPanel, RuntimeHUD, useRuntimeCommands } from '@artinos/r3f'
```
