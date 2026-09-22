# @artinos/metablock 0.16.0

ARTINOS's reusable **TypeScript MetaBlock spatial engine with a React renderer**.

## Canonical rule

There is one spatial primitive:

```text
MetaBlock = SPACE
```

Panel, dock, viewport, group, sidebar, toolbar, floating window and popout are MetaBlock roles/postures — not separate primitive classes.

The package owns:

- authoritative MetaBlock registry
- grouped/container MetaBlocks + tab relationships
- reorder / regroup / detach
- dock / split / merge
- floating windows
- locked fullscreen render surfaces
- snapping and smart guides
- Dock Fields + intent hysteresis
- exact landing previews
- Workspace Zones
- pinned / auto-hide / popout states
- recursive Workspaces
- maximize / restore
- persistence + history
- MetaBlend topology model
- spatial physics: direct manipulation, restrained lift/attitude, magnetism and fast settle
- React `MetaBlockWorkspaceView`

The core graph/geometry/physics is framework-independent TypeScript. React is the canonical renderer.

## Example

```tsx
import { MetaBlockWorkspace, MetaBlockWorkspaceView } from '@artinos/metablock';
import '@artinos/metablock/styles.css';

const workspace = new MetaBlockWorkspace();
const dock = workspace.createGroup({ id: 'dock', role: 'dock' });
workspace.createMetaBlock({ id: 'scene', title: 'Scene', role: 'panel' }, { groupId: dock });
workspace.createMetaBlock({ id: 'material', title: 'Material', role: 'panel' }, { groupId: dock });

export function Workspace() {
  return (
    <MetaBlockWorkspaceView
      workspace={workspace}
      renderBlock={(block) => <div>{block.title}</div>}
      motion={{ profile: 'physical', magnetism: .58, inertia: .10 }}
    />
  );
}
```

Each child MetaBlock can independently float, dock, split or merge without losing identity:

```ts
workspace.floatBlock('material');
workspace.dockBlock('material', { area: 'right' });
workspace.mergeBlock('material', 'dock');
```

## 0.16 dock containment + state-transition refinement

This release hardens the canonical parent/child model used by ARTINOS Studio:

```text
LOCKED FULLSCREEN VIEWPORT
└── persistent Dock MetaBlock
    ├── Scene Panel MetaBlock
    ├── Material Panel MetaBlock
    ├── Render Panel MetaBlock
    └── Bake Panel MetaBlock
```

Key invariants:

- ordinary leaf/panel MetaBlocks cannot become an accidental root-center/fullscreen dock;
- `repairSpatialState()` repairs stale extracted root-center layouts to bounded floating geometry and restores persistent Docks to their declared home Workspace Zone;
- a Dock can declare `homeZoneId`, `homeZoneMode` and `lockHomeZone`;
- dragging a docked single-panel surface morphs toward its preferred floating size before it becomes free-floating;
- an unarmed Workspace-edge release uses `snapGroupToEdge()` / `snapBlockToEdge()` and remains floating; holding the stronger Dock Field arms structural docking;
- Dock targets are merge/attach targets rather than split targets; ordinary group edges still support split;
- the remembered parent and tab index are used for exact return-home; after a real regroup into another stable Dock/Group, that new parent becomes the next return relationship;
- detached panel chrome remains draggable, allowing float → dock → regroup → return transitions without app-level behavior;
- explicit maximize is distinct from the permanently locked fullscreen viewport; accidental double-click maximize is not part of the default renderer interaction;
- right-click actions are generated from MetaBlock relationship/capability state.

The package keeps **drag pose** separate from **committed workspace topology**. Pointer movement can preview/snap/attract, while group/dock/split/merge mutations commit at release.

