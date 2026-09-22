/**
 * MetaBlock — the ARTINOS spatial engine: one primitive (a MetaBlock) whose
 * roles are panel, dock, viewport and window. Docking, splitting, tabbing,
 * floating, pinning, maximize/restore, snapping, persistence and undo.
 *
 * Copy this whole folder. The core is framework-free TypeScript; the React
 * renderer is `MetaBlockWorkspaceView`. Requires react >= 18.
 *
 *   const workspace = new MetaBlockWorkspace()
 *   const dock = workspace.createGroup({ id: 'dock', role: 'dock' })
 *   workspace.createMetaBlock({ id: 'scene', title: 'Scene' }, { groupId: dock })
 *   workspace.dockGroup(dock, { area: 'bottom', size: 0.36 })
 *   <MetaBlockWorkspaceView workspace={workspace} renderBlock={b => <Panel id={b.id} />} />
 */
import './MetaBlock.css'
export * from './core/types'
export * from './core/workspace'
export * from './core/spatial'
export * from './core/layout'
export * from './core/physics'
export * from './react/WorkspaceView'
export * from './react/BlockBody'
export * from './react/hooks'
