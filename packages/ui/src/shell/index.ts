/**
 * Workspace shell — docking, panels, toolbar and the command palette.
 *
 * The panel system is three layers: `panel-types` declares a panel, `panel-layout` holds
 * every state transition as a pure function, and the components render the result.
 */
export { definePanel, type PanelDefinition, type PanelState, type PanelLayout, type Dock, type EdgeDock, type PanelIcon } from './panel-types'
export * as panelLayout from './panel-layout'
export { PanelHostProvider, usePanelHost, type PanelHost } from './panel-host'
export { PanelWorkspace, type PanelWorkspaceProps } from './PanelWorkspace'
export { MetaBlockShell, type MetaBlockShellProps } from './MetaBlockShell'
export { PanelFrame, DockDropZone } from './PanelFrame'
export { PanelRail } from './PanelRail'
export { DockToolbar, WorkspaceChrome } from './DockToolbar'
export { DockArea, Panel } from './DockArea'
export { BrandChip, BrandChipView } from './BrandChip'
export { DockTabs } from './DockTabs'
export { DockControls } from './DockControls'
export { useConfirmDialog } from './ConfirmDialog'
export {
  Workspace,
  ViewportSlot,
  useWorkspaceLayout,
  useWorkspaceTheme,
  type WorkspaceLayout,
  type WorkspaceTheme,
  type Backdrop,
} from './workspace-context'
export { CommandPalette } from './CommandPalette'
export { registerCommandSource, listCommandSources, useCommandSources, type CommandItem, type CommandSource } from './command-registry'
export { reveal, clearReveal, useReveal, type RevealTarget } from './reveal'
