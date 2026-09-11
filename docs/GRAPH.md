# Graph Studio

The Graph panel has two modes.

## Live

The default. A read-only graph **generated from the running system** — nothing here is authored. It reads the runtime, the Three scene and the PostFX controller on every poll and lays out what it finds in five columns:

```text
Input          Logic            Parameters      Scene              Render
live signals → bindings/graphs → driven params → modules/objects → scene pass → effects → output
```

Every edge is a fact, not a guess: signal→binding comes from the binding definition, graph→parameter from the graph's write nodes, parameter→module from the module manifest that declares that parameter, object→scene pass from a live scene traversal, and the effect chain from the controller's real pipeline order. A parameter with no verifiable consumer is drawn with no outgoing edge rather than wired to a plausible guess.

Hovering a node dims everything it is not connected to. The Scene Pass, Output and G-buffer nodes carry live thumbnails, captured from the real render targets through the shared renderer.

Live nodes are real nodes, not labels: a light carries its visibility and intensity, a PostFX effect carries its enable and every parameter, a parameter carries its base value, a signal plots its own history, and the render targets carry thumbnails. Editing a control writes straight through to the live object, and the node reads back from it on the next tick, so a node can never disagree with what is running.

Selecting a node also opens an inspector that **edits the thing itself**, not a copy: a parameter gets its registered control plus base/resolved readouts, a PostFX effect gets its enable, order and every real parameter, a scene object gets visibility, intensity and position, a signal gets its history plot, and an authored graph gets a jump into the editor.

## Edit

`@artinos/graph` is a schema-driven node system with one editor and five execution domains. A graph is plain JSON, lives in the project (or in persisted project state), and is evaluated by the runtime's frame coordinator.

## Domains

| Domain | Writes | Schedule |
|---|---|---|
| `signal` | signals and parameters | every frame |
| `parameter` | the same evaluator, scoped to parameter authoring | every frame |
| `scene` | transforms, visibility, material properties on named objects | every frame |
| `render` | PostFX effect enable/order/parameters in the one shared pipeline | every frame |
| `gpu` | a compiled TSL node published as `graph.<id>.tsl` | on change |

Scene and render graphs include the whole numeric node set, so a transform channel or an effect parameter can be driven by `audio.bass` through the same maths nodes a signal graph uses. GPU graphs are the exception: they compile when the definition changes, and each frame only pushes uniform values. Rebuilding a TSL node graph every frame forces a pipeline recompile and stalls the renderer.

## Node schema

Every node type is declared once in `packages/graph/src/schema.ts` with its category, domains, description, typed input/output ports and editable fields. That single declaration drives validation, the executors' port lookup, the palette, the node body and the inspector — adding a node type means adding one schema entry and one `case` in the relevant executor.

Ports are typed (`number`, `object`, `node`, …). `canConnect` rejects type mismatches, occupied single-value inputs, self-connections and anything that would close a feedback cycle, before the edge is ever created.

## Editor

The Graph panel is a full node editor:

- **Wiring** — drag between ports; drag off a connected input to re-route it; drop a wire on empty canvas to get a palette filtered to nodes that can accept it, then auto-connect.
- **Navigation** — wheel to zoom at the cursor, middle/right/alt-drag to pan, `F` or Fit to frame the graph.
- **Selection** — click, shift-click, marquee drag, `Ctrl+A`.
- **Editing** — `Delete`, `Ctrl+D` duplicate, `Ctrl+C`/`Ctrl+V`, `Ctrl+Z`/`Ctrl+Shift+Z`, grid snapping.
- **Arranging** — Tidy lays the graph out by dependency depth; the Arrange menu aligns, distributes, or reflows the selection into a row or column.
- **Subgraphs** — group two or more selected nodes into a named box that reads as one unit, and ungroup to dissolve it. A node belongs to one group at a time, and groups are part of the definition so they persist and export.
- **Live values** — each node header shows its current output and wires carry their value; diagnostics ring the offending node and the diagnostics list selects it.
- **Portability** — per-graph JSON copy/import, templates per domain, duplicate and rename.

Node moves are one undo entry per drag, and persistence is debounced — dragging a node does not write to `localStorage` on every pointer move.

## Evaluation and failure

`GraphEngine.runAll` is the frame path. It caches the registry list by revision (the registry deep-clones on `list()`), computes one delta per frame for stateful nodes such as `smooth`, and skips re-validating graphs whose definition has not changed.

A graph that throws does not abort the frame. It is recorded with an error, reported through the panel's diagnostics, logged once rather than every frame, and left alone until its definition changes.

## Authoring a graph in a project

```ts
const pulse:GraphDefinition={
  id:'orb-pulse',name:'Orb Pulse',domain:'signal',enabled:true,
  nodes:[
    {id:'bass',type:'signal',x:36,y:36,data:{id:'audio.bass'}},
    {id:'settle',type:'smooth',x:300,y:36,data:{amount:.82}},
    {id:'drive',type:'write-parameter',x:564,y:36,data:{id:'visual.orb.energy'}},
  ],
  edges:[
    {id:'e1',from:'bass',to:'settle',output:'value',input:'value'},
    {id:'e2',from:'settle',to:'drive',output:'value',input:'value'},
  ],
}
```

Pass it as `graphs:[pulse]` on the project manifest.

**One parameter, one writer.** `write-parameter` and the binding engine both write the resolved channel, so pointing a binding and a graph at the same parameter makes them fight. Pick one.
