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
