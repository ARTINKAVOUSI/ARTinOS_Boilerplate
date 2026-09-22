import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CornerUpLeft, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { MetaBlockWorkspace, MetaBlockWorkspaceView } from '@artinos/metablock'
import type { GroupChromeContext, MetaBlockGroup, MetaBlockInstance } from '@artinos/metablock'
import { RuntimeHUD } from '../panels/RuntimeHUD'
import { Workspace } from '@artinos/ui'
import { useShortcut } from '@artinos/ui'
import { CommandPalette } from '@artinos/ui'
import { registerCommandSource, type CommandItem } from '@artinos/ui'
import { BrandChipView } from '@artinos/ui'
import type { Dock, PanelDefinition } from '@artinos/ui'
import '@artinos/metablock/styles.css'
// After the engine's stylesheet: binds its variables to the @artinos/ui tokens.
import '../chrome.css'

export interface MetaBlockShellProps {
  panels: PanelDefinition[]
  viewport: ReactNode
  persistKey?: string
  statusOverlay?: ReactNode
}

/** Panel docks map onto MetaBlock dock groups. `float` has no dock group — those blocks start detached. */
const EDGE_BY_DOCK: Record<Exclude<Dock, 'float'>, 'left' | 'right' | 'bottom'> = { left: 'left', right: 'right', bottom: 'bottom' }
const DOCK_SIZE: Record<'left' | 'right' | 'bottom', number> = { left: .22, right: .24, bottom: .36 }

/**
 * Build the MetaBlock workspace from the same `PanelDefinition[]` the classic shell uses.
 *
 * The viewport is a `lockedFullscreen` group: MetaBlock gives it the whole surface at z-index 0
 * and strips its capabilities, so the 3D canvas is an immovable backdrop the panels float over
 * rather than a participant in docking. That mirrors the existing shell's ViewportSlot without
 * needing a special case inside the engine.
 */
function buildWorkspace(panels: PanelDefinition[], persistKey: string) {
  const workspace = new MetaBlockWorkspace({ id: 'artinos.studio' })

  workspace.createGroup({ id: 'viewport', title: 'Viewport', role: 'viewport', lockedFullscreen: true })
  workspace.createMetaBlock({ id: 'viewport.canvas', title: 'Viewport', role: 'viewport' }, { groupId: 'viewport' })

  // One dock group per edge that actually has panels, so an empty edge costs nothing.
  const byDock = new Map<Exclude<Dock, 'float'>, PanelDefinition[]>()
  const floating: PanelDefinition[] = []
  for (const panel of [...panels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    if (panel.dock === 'float') { floating.push(panel); continue }
    const dock = (panel.dock ?? 'bottom') as Exclude<Dock, 'float'>
    byDock.set(dock, [...(byDock.get(dock) ?? []), panel])
  }

  for (const [dock, members] of byDock) {
    const groupId = `dock.${dock}`
    // `persistentContainer` keeps the dock alive when its last child is dragged out, so panels
    // have somewhere to return to instead of the dock silently disappearing.
    workspace.createGroup({ id: groupId, title: dock[0].toUpperCase() + dock.slice(1), role: 'dock', meta: { persistentContainer: true } })
    for (const panel of members) {
      workspace.createMetaBlock(
        // `meta` is snapshotted with structuredClone for undo/persist, so it must stay JSON-safe.
        // Anything React-valued (footer is a ReactNode) is resolved at render time from the panel
        // definitions instead — putting an element here throws "could not be cloned".
        { id: panel.id, title: panel.title, role: 'panel', meta: { description: panel.description ?? null } },
        { groupId },
      )
    }
    workspace.dockGroup(groupId, { area: EDGE_BY_DOCK[dock], size: DOCK_SIZE[EDGE_BY_DOCK[dock]] })
    const first = members.find(panel => panel.visible !== false) ?? members[0]
    if (first) workspace.activateBlock(first.id)
  }

  for (const panel of floating) {
    workspace.createMetaBlock({ id: panel.id, title: panel.title, role: 'panel' })
    workspace.floatBlock(panel.id, { x: 120, y: 120, width: panel.size ?? 420, height: 340 })
  }

  // A saved layout wins over the defaults above, but only if it still matches the declared panels —
  // otherwise a renamed or removed panel would resurrect as an empty block.
  try {
    const raw = localStorage.getItem(persistKey)
    if (raw) {
      const snapshot = JSON.parse(raw)
      const known = new Set(panels.map(panel => panel.id).concat('viewport.canvas'))
      const saved: string[] = (snapshot?.blocks ?? []).map((block: MetaBlockInstance) => block.id)
      if (saved.length && saved.every(id => known.has(id))) workspace.restore(snapshot)
    }
  } catch { /* a corrupt or foreign layout falls back to the declared defaults */ }

  return workspace
}

export function MetaBlockShell({ panels, viewport, persistKey = 'artinos.studio.metablock-v1', statusOverlay }: MetaBlockShellProps) {
  const workspace = useMemo(() => buildWorkspace(panels, persistKey), [panels, persistKey])
  const byId = useMemo(() => new Map(panels.map(panel => [panel.id, panel])), [panels])
  const [paletteOpen, setPaletteOpen] = useState(false)
  useShortcut(useMemo(() => ({ key: 'k', meta: true }), []), () => setPaletteOpen(true))

  useEffect(() => {
    let frame = 0
    const save = () => {
      cancelAnimationFrame(frame)
      // Drag emits per pointer move; coalescing to a frame keeps localStorage off the hot path.
      frame = requestAnimationFrame(() => {
        try { localStorage.setItem(persistKey, JSON.stringify(workspace.serialize())) } catch { /* quota or private mode */ }
      })
    }
    const off = workspace.on('*', save)
    return () => { cancelAnimationFrame(frame); off() }
  }, [workspace, persistKey])

  // Layout undo/redo is deliberately not on Cmd+Z: that belongs to `runtime.undo()` (parameter
  // edits), and `useShortcut` matches on key+meta only — it ignores `shift`, so a Cmd+Z /
  // Cmd+Shift+Z pair would fire both handlers on the same press and cancel out.
  useEffect(
    () =>
      registerCommandSource({
        id: 'metablock-layout',
        collect: () => [
          { id: 'layout:undo', title: 'Undo layout change', subtitle: 'MetaBlock workspace', group: 'Layout', hint: 'undo', run: () => workspace.undo() },
          { id: 'layout:redo', title: 'Redo layout change', subtitle: 'MetaBlock workspace', group: 'Layout', hint: 'redo', run: () => workspace.redo() },
        ],
      }),
    [workspace],
  )

  // Panels stay reachable from the palette even when their dock is collapsed or they were closed.
  useEffect(
    () =>
      registerCommandSource({
        id: 'metablock-panels',
        collect: () =>
          panels.map<CommandItem>(panel => ({
            id: `panel:${panel.id}`,
            title: panel.title,
            subtitle: workspace.blocks.has(panel.id) ? (workspace.getBlockGroup(panel.id)?.title ?? 'detached') : 'closed',
            group: 'Panels',
            keywords: `panel ${panel.id} ${panel.keywords?.join(' ') ?? ''} ${panel.description ?? ''}`,
            icon: panel.icon,
            hint: workspace.blocks.has(panel.id) ? 'focus' : 'open',
            run: () => {
              if (!workspace.blocks.has(panel.id)) {
                workspace.createMetaBlock({ id: panel.id, title: panel.title, role: 'panel' }, { groupId: workspace.groups.has('dock.bottom') ? 'dock.bottom' : undefined })
              }
              workspace.activateBlock(panel.id)
            },
          })),
      }),
    [panels, workspace],
  )

  /**
   * Panel content must keep the original wrappers. `.artinos-panel` / `.artinos-panel-body` carry
   * the panel's scroll container, padding and control sizing — rendering `definition.content`
   * bare drops 40+ lines of scoped CSS and the panel blows out to unstyled full-size controls.
   */
  const renderBlock = (block: MetaBlockInstance) => {
    // R3F sizes its canvas by observing its parent box. Handing it the raw canvas leaves it
    // measuring whatever ancestor it lands in, so it keeps the size from first mount and never
    // follows a window resize (observed 1031x524 canvas inside a 1587x802 viewport). The classic
    // shell's ViewportSlot wrapper is what gives it a stable, full-bleed box to measure.
    if (block.id === 'viewport.canvas') return <main className="artinos-viewport">{viewport}</main>
    const definition = byId.get(block.id)
    if (!definition) return null
    return (
      <div className={`artinos-panel artinos-panel-${definition.id} is-open`}>
        <div className="artinos-panel-body">{definition.content}</div>
      </div>
    )
  }

  /** Tab strip shared by both chromes: the same element carries selection, drag-out and menu. */
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

  /**
   * Chrome is per role, because MetaBlock calls this for every group.
   *
   * The dock owns the workspace furniture — tab strip, search and the single RuntimeHUD. A
   * detached panel is still a MetaBlock group, so it gets chrome too, but only its own tab bar
   * and window controls: rendering the HUD here as well gave every torn-off panel a duplicate
   * telemetry readout. Both use the original `plate-*` classes so the aesthetic is unchanged.
   */
  const renderGroupChrome = (context: GroupChromeContext) =>
    context.group.role === 'dock' ? (
      <header className="plate-dock-toolbar" {...context.dragHandleProps}>
        {tabStrip(context, 'plate-dock-tabs')}
        <button className="plate-search-entry" data-no-drag onClick={() => setPaletteOpen(true)} title="Search everything (Ctrl/Cmd + K)">
          <Search size={12} />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="plate-toolbar-cluster" data-no-drag>
          <button type="button" className="artinos-workspace-expand" aria-label={context.group.posture === 'maximized' ? 'Restore workspace panel' : 'Expand workspace panel'} title={context.group.posture === 'maximized' ? 'Restore workspace panel' : 'Expand workspace panel'} onClick={() => context.group.posture === 'maximized' ? context.restore() : context.maximize()}>{context.group.posture === 'maximized' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          <div className="plate-toolbar-status">
            <RuntimeHUD embedded />
          </div>
        </div>
      </header>
    ) : (
      <header className="artinos-panel-header artinos-metablock-panel-header" {...context.dragHandleProps}>
        {tabStrip(context, 'plate-dock-tabs artinos-metablock-panel-tabs')}
        <div className="artinos-panel-toolbar" data-no-drag>
          {context.blockActions && context.activeBlock ? (
            <>
              <button
                className="artinos-panel-float"
                title={context.group.posture === 'maximized' ? 'Restore' : 'Maximize'}
                onClick={() => (context.group.posture === 'maximized' ? context.restore() : context.maximize())}
              >
                {context.group.posture === 'maximized' ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>
              <button
                className="artinos-panel-float"
                title="Return to its dock"
                onClick={() => context.blockActions.returnHome(context.activeBlock!.id)}
              >
                <CornerUpLeft size={11} />
              </button>
              <button className="artinos-panel-close" title="Close panel" onClick={() => context.blockActions.close(context.activeBlock!.id)}>
                <X size={11} />
              </button>
            </>
          ) : null}
        </div>
      </header>
    )

  const renderGroupFooter = (group: MetaBlockGroup) => {
    const footer = byId.get(group.activeChild ?? '')?.footer
    return footer ? <>{footer}</> : null
  }

  return (
    <>
      {/* `plate-workspace` carries the design-system scope: panel styling and the --ui-* token
          aliases in theme.css are declared under it, so panels look identical in either shell.
          `Workspace` supplies the layout/theme contexts the shared chrome (RuntimeHUD) reads. */}
      <Workspace persistKey={`${persistKey}.docks`}>
        <div className="artinos-metablock-shell plate-workspace">
          <MetaBlockWorkspaceView
            workspace={workspace}
            renderBlock={renderBlock}
            renderGroupChrome={renderGroupChrome}
            renderGroupFooter={renderGroupFooter}
            // The original shell floats its dock card inset from the viewport edges rather than
            // butting it against them; padding/gap reproduce that inset for every docked group.
            padding={10}
            gap={8}
          />
          <BrandChipView context={byId.get(workspace.groups.get(workspace.focusedGroup ?? '')?.activeChild ?? '')?.title ?? 'Studio'} />
          {statusOverlay}
        </div>
      </Workspace>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
