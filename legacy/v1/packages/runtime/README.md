# @artinos/runtime

Renderer-agnostic state plus the shared R3F renderer bridge. Owns parameters, signals,
resources, modules, bindings, automation, quality, telemetry, history and persistence.

Depends on: nothing in this workspace.

```tsx
import { ArtinosRuntimeProvider, createArtinosRuntime, useArtinosRuntime, useParameter } from '@artinos/runtime'

const runtime = createArtinosRuntime()

function Speed() {
  const [speed, setSpeed] = useParameter({ id: 'demo.speed', type: 'number', defaultValue: 1, min: 0, max: 4 })
  return <input type="range" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
}

export const App = () => (
  <ArtinosRuntimeProvider runtime={runtime}>
    <Speed />
  </ArtinosRuntimeProvider>
)
```

Every other package observes these contracts. Nothing here imports React Three Fiber
state or device loops directly — that keeps the runtime testable without a GPU.
