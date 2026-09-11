# @artinos/inputflow

Device capture and normalized live signals: pointer, keyboard, gamepad and webcam vision.
Publishes semantic signals into the runtime; owns no UI.

Depends on: `@artinos/runtime`, `@mediapipe/tasks-vision`.

```tsx
import { InputProvider, useInputSignal } from '@artinos/inputflow'

function Cursor() {
  const pointer = useInputSignal('pointer.position')
  return <span>{pointer?.[0]?.toFixed(2)}</span>
}

export const App = () => (
  <InputProvider>
    <Cursor />
  </InputProvider>
)
```

Vision runs in a worker. Its models are fetched by `scripts/setup-vision-assets.mjs` at
install time, so the package works offline after the first install.
