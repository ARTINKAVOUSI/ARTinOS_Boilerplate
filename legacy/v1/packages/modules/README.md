# @artinos/modules

Reusable scene, lighting, environment, camera, shadow and native TSL PostFX capabilities,
their presets, and the module catalog the Library panel and command palette read.

Depends on: `@artinos/runtime`, `@react-three/drei`, `@react-three/fiber`, `three`.

```tsx
import { defs, nativeModuleCatalog, postFXCatalog, scenePresets } from '@artinos/modules'
import { Content } from '@artinos/modules/content'

// `defs` are parameter definitions — the same ids the panels and palette resolve.
const fogNear = defs.fogNear
```

Sub-path exports (`/scene`, `/postfx`, `/content`, `/catalog`) keep a project from
pulling the whole catalog when it needs one family.
