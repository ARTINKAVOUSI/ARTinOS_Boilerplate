# @artinos/graph

Node schema, typed-port validation, registry, templates and the domain executors. One
schema declaration per node type drives validation, execution and the editor UI.

Depends on: `@artinos/runtime`.

```ts
import { GraphEngine, GraphRegistry, validateGraph } from '@artinos/graph'

const registry = new GraphRegistry()
registry.upsert(myGraph)

const diagnostics = validateGraph(myGraph)
if (!diagnostics.length) new GraphEngine(runtime).runAll(registry, performance.now())
```

Adding a node type means adding one schema entry. Do not special-case a node in the
editor — if the editor needs to know something, it belongs in the schema.
