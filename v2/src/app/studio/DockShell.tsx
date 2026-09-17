import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { MetaBlockWorkspace, MetaBlockWorkspaceView, useWorkspaceRevision, type GroupChromeContext, type MetaBlockGroup, type MetaBlockInstance } from '../../ui/MetaBlock'
import { CommandPalette, type Command } from '../../ui/CommandPalette/CommandPalette'
import { panels, type DiscoveredPanel } from '../panel'
import { features } from '../registry'
import { studio, useStudio, type StudioState } from '../store'
import { PanelWorkbench } from './PanelWorkbench'
import { RuntimeHUD } from './RuntimeHUD'
import { ConsoleToast } from './ConsoleToast'
import { DOCK_LAYOUT_KEY as PERSIST_KEY, resetDockLayout } from './layout'
import { Icons } from './icons'
// After the engine's own stylesheet: binds its variables to the studio tokens.
import './skin/chrome.css'
import './dock.css'

const DOCK_SIZE = { left: 0.22, right: 0.24, bottom: 0.36 } as const
const WORLDS = ['frost', 'clear', 'satin', 'graphite', 'opal', 'monolith'] as const
const selectUI = (state: StudioState) => state.ui

/**
 * Build the MetaBlock workspace from the discovered panels.
 *
 * The viewport is a locked fullscreen group — an immovable backdrop the panels
 * float over. Each edge that has panels gets one persistent dock group, so a
 * panel dragged out always has a home to return to.
 */
function buildWorkspace(list: DiscoveredPanel[]) {
  const workspace = new MetaBlockWorkspace({ id: 'artinos.v2.studio' })
  workspace.createGroup({ id: 'viewport', title: 'Viewport', role: 'viewport', lockedFullscreen: true })
  workspace.createMetaBlock({ id: 'viewport.canvas', title: 'Viewport', role: 'viewport' }, { groupId: 'viewport' })

  const byDock = new Map<'left' | 'right' | 'bottom', DiscoveredPanel[]>()
  const floating: DiscoveredPanel[] = []
  for (const panel of list) {
    if (panel.dock === 'float') {
      floating.push(panel)
      continue
    }
    const dock = panel.dock ?? 'bottom'
    byDock.set(dock, [...(byDock.get(dock) ?? []), panel])
  }

  for (const [dock, members] of byDock) {
    const groupId = `dock.${dock}`
    workspace.createGroup({ id: groupId, title: dock[0].toUpperCase() + dock.slice(1), role: 'dock', meta: { persistentContainer: true } })
    // `meta` is structured-cloned for undo and persistence, so it stays JSON-safe.
    for (const panel of members) workspace.createMetaBlock({ id: panel.id, title: panel.title, role: 'panel', meta: { description: panel.description ?? null } }, { groupId })
    workspace.dockGroup(groupId, { area: dock, size: DOCK_SIZE[dock] })
    const first = members.find(panel => panel.active) ?? members[0]
    if (first) workspace.activateBlock(first.id)
  }
  for (const panel of floating) {
    workspace.createMetaBlock({ id: panel.id, title: panel.title, role: 'panel' })
    workspace.floatBlock(panel.id, { x: 120, y: 120, width: 420, height: 340 })
  }

  // A saved layout wins, but only while it still matches the panels on disk —
  // a deleted panel file must not come back as an empty tab.
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (raw) {
      const snapshot = JSON.parse(raw)
      const known = new Set(list.map(panel => panel.id).concat('viewport.canvas'))
      const saved: string[] = (snapshot?.blocks ?? []).map((block: MetaBlockInstance) => block.id)
      const complete = list.every(panel => saved.includes(panel.id))
      if (saved.length && complete && saved.every(id => known.has(id))) workspace.restore(snapshot)
    }
  } catch {
    /* a corrupt or foreign layout falls back to the defaults */
  }
  return workspace
}

function BrandChip({ context }: { context: string }) {
  return (
    <div className="plate-brand-chip">
      <b>ARTINOS</b>
      <span className="plate-brand-context">{context}</span>
    </div>
  )
}

export function DockShell({ viewport }: { viewport: ReactNode }) {
  const workspace = useMemo(() => buildWorkspace(panels), [])
  const byId = useMemo(() => new Map(panels.map(panel => [panel.id, panel])), [])
  // The brand chip follows the focused panel, so the shell re-renders on layout changes.
  useWorkspaceRevision(workspace)
  const ui = useStudio(selectUI)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.world = ui.world
  }, [ui.world])

  // Persist on every change, coalesced to a frame so drags stay off localStorage.
  useEffect(() => {
    let frame = 0
    const off = workspace.on('*', () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        try {
          localStorage.setItem(PERSIST_KEY, JSON.stringify(workspace.serialize()))
        } catch {
          /* quota or private mode */
        }
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      off()
    }
  }, [workspace])

  const openPanel = useCallback(
    (id: string) => {
      const panel = byId.get(id)
      if (!panel) return
      if (!workspace.blocks.has(id)) workspace.createMetaBlock({ id, title: panel.title, role: 'panel' }, { groupId: workspace.groups.has('dock.bottom') ? 'dock.bottom' : undefined })
      workspace.activateBlock(id)
    },
    [byId, workspace],
  )

  // H hides the studio chrome; the scene stays.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'h' || event.key === 'H') studio.setUI({ visible: !studio.getState().ui.visible })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands = useMemo<Command[]>(
    () => [
      ...panels.map(panel => ({
        id: `panel.${panel.id}`,
        label: panel.title,
        group: 'Panels',
        keywords: `panel ${panel.description ?? ''} ${(panel.keywords ?? []).join(' ')}`,
        run: () => openPanel(panel.id),
      })),
      { id: 'layout.undo', label: 'Undo layout change', group: 'Layout', run: () => workspace.undo() },
      { id: 'layout.redo', label: 'Redo layout change', group: 'Layout', run: () => workspace.redo() },
      { id: 'layout.reset', label: 'Reset dock layout', group: 'Layout', run: resetDockLayout },
      { id: 'ui.toggle', label: 'Hide / show interface', group: 'View', shortcut: 'H', run: () => studio.setUI({ visible: !studio.getState().ui.visible }) },
      ...WORLDS.map(world => ({ id: `world.${world}`, label: `Material world: ${world}`, group: 'View', run: () => studio.setUI({ world }) })),
      { id: 'reset.all', label: 'Reset every feature', group: 'Features', run: () => studio.resetAll() },
      ...features.map(feature => ({
        id: `toggle.${feature.id}`,
        label: `Toggle ${feature.label}`,
        group: feature.kind === 'effect' ? 'Effects' : (feature.group ?? 'Features'),
        keywords: `${feature.id} ${feature.category ?? ''} ${feature.path}`,
        run: () => studio.setEnabled(feature.id, !studio.getState().features[feature.id]?.enabled),
      })),
    ],
    [openPanel, workspace],
  )

  const renderBlock = (block: MetaBlockInstance) => {
    // R3F sizes its canvas from its parent box; this wrapper gives it a stable full-bleed one.
    if (block.id === 'viewport.canvas') return <main className="artinos-viewport">{viewport}</main>
    const panel = byId.get(block.id)
    if (!panel) return null
    const Content = panel.component
    return (
      <div className={`artinos-panel artinos-panel-${panel.id} is-open`}>
        <div className="artinos-panel-body">
          <PanelWorkbench title={panel.title}>
            <Content />
          </PanelWorkbench>
        </div>
      </div>
    )
  }

  /** One tab strip for both chromes: selection, drag-out and the context menu live on the same element. */
  const tabStrip = (context: GroupChromeContext, className: string) => (
    <div className={className} data-mb-tabs="true" role="tablist" aria-label={`${context.group.title} panels`}>
      {context.blocks.map(block => (
        <button
          key={block.id}
          type="button"
          role="tab"
          aria-selected={block.id === context.activeBlock?.id}
          className={block.id === context.activeBlock?.id ? 'is-active' : ''}
          title={byId.get(block.id)?.description ?? block.title}
          {...context.blockProps(block.id)}
        >
          <span className="plate-tab-label">{block.title}</span>
        </button>
      ))}
    </div>
  )

  const maximized = (context: GroupChromeContext) => context.group.posture === 'maximized'

  /**
   * The dock carries the workspace furniture: tabs, search, expand and the HUD.
   * A detached panel gets only its tabs and window controls.
   */
  const renderGroupChrome = (context: GroupChromeContext) =>
    context.group.role === 'dock' ? (
      <header className="plate-dock-toolbar" {...context.dragHandleProps}>
        {tabStrip(context, 'plate-dock-tabs')}
        <button type="button" className="plate-search-entry" data-no-drag onClick={() => setPaletteOpen(true)} title="Search everything (Ctrl/Cmd + K)">
          {Icons.search}
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="plate-toolbar-cluster" data-no-drag>
          <button
            type="button"
            className="artinos-workspace-expand"
            aria-label={maximized(context) ? 'Restore workspace panel' : 'Expand workspace panel'}
            title={maximized(context) ? 'Restore workspace panel' : 'Expand workspace panel'}
            onClick={() => (maximized(context) ? context.restore() : context.maximize())}
          >
            {maximized(context) ? Icons.minimize : Icons.maximize}
          </button>
          <div className="plate-toolbar-status">
            <RuntimeHUD />
          </div>
        </div>
      </header>
    ) : (
      <header className="artinos-panel-header artinos-metablock-panel-header" {...context.dragHandleProps}>
        {tabStrip(context, 'plate-dock-tabs artinos-metablock-panel-tabs')}
        <div className="artinos-panel-toolbar" data-no-drag>
          {context.activeBlock && (
            <>
              <button type="button" className="artinos-panel-float" title={maximized(context) ? 'Restore' : 'Maximize'} onClick={() => (maximized(context) ? context.restore() : context.maximize())}>
                {maximized(context) ? Icons.minimize : Icons.maximize}
              </button>
              <button type="button" className="artinos-panel-float" title="Return to its dock" onClick={() => context.blockActions.returnHome(context.activeBlock!.id)}>
                {Icons.returnHome}
              </button>
              <button type="button" className="artinos-panel-close" title="Close panel" onClick={() => context.blockActions.close(context.activeBlock!.id)}>
                {Icons.close}
              </button>
            </>
          )}
        </div>
      </header>
    )

  const renderGroupFooter = (group: MetaBlockGroup) => {
    const Footer = byId.get(group.activeChild ?? '')?.footer
    return Footer ? <Footer /> : null
  }

  const focused = workspace.groups.get(workspace.focusedGroup ?? '')?.activeChild ?? workspace.groups.get('dock.bottom')?.activeChild ?? ''

  return (
    <>
      <div className="artinos-metablock-shell plate-workspace" data-ui-hidden={!ui.visible || undefined}>
        <MetaBlockWorkspaceView workspace={workspace} renderBlock={renderBlock} renderGroupChrome={renderGroupChrome} renderGroupFooter={renderGroupFooter} padding={10} gap={8} />
        <BrandChip context={byId.get(focused)?.title ?? 'Studio'} />
        <ConsoleToast onOpen={() => openPanel('console')} />
        {!ui.visible && <div className="v2-ui-hint">Press H to show the interface</div>}
      </div>
      <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
