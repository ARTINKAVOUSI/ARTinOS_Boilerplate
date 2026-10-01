import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { MetaBlockWorkspace, MetaBlockWorkspaceView, useWorkspaceRevision, type GroupChromeContext, type MetaBlockGroup, type MetaBlockInstance } from '../../ui/MetaBlock'
import { CommandPalette, type Command } from '../../ui/CommandPalette/CommandPalette'
import { GLASS_THEMES, THEME_META } from '../../ui/system/utils'
import { panels, type DiscoveredPanel } from '../panel'
import { features } from '../registry'
import type { DiscoveredFeature } from '../feature'
import { labelOf } from './ControlField'
import { studio, useStudio, type StudioState } from '../store'
import { PanelWorkbench } from './PanelWorkbench'
import { PanelBarSlot, PanelIdContext } from './PanelBar'
import { RuntimeHUD } from './RuntimeHUD'
import { ConsoleToast } from './ConsoleToast'
import { DOCK_LAYOUT_KEY as PERSIST_KEY, isResettingLayout, resetDockLayout } from './layout'
import { Icons } from './icons'
import { DockMenu } from './DockMenu'
// After the engine's own stylesheet: binds its variables to the studio tokens.
import './skin/chrome.css'
import './dock.css'
import './panels.css'

/** Which panel shows a feature's controls — each panel claims its own. */
function panelFor(feature: DiscoveredFeature) {
  return panels.find(panel => panel.owns?.(feature))?.id ?? panels[0]?.id ?? ''
}

const DOCK_SIZE = { left: 0.22, right: 0.24, bottom: 0.36 } as const
const FLOAT_BOUNDS = { x: 120, y: 120, width: 420, height: 340 }
/** Layout changes are written out once they settle, never per drag or resize frame. */
const PERSIST_DELAY_MS = 300
/** Workspace events that do not change the saved arrangement. */
const TRANSIENT_EVENTS = new Set(['focus', 'selection'])
const selectUI = (state: StudioState) => state.ui
const selectReveal = (state: StudioState) => state.reveal

/** Keys typed into a field, a list or a slider are for that control, not the studio. */
const typingTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="slider"], [role="spinbutton"], [role="textbox"]')

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
    workspace.floatBlock(panel.id, FLOAT_BOUNDS)
  }

  // A saved layout wins while every tab in it is still a panel on disk — a
  // deleted panel file must not come back as an empty tab. Panels added since
  // (or closed then) join their dock; everything else keeps its place.
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (raw) {
      const snapshot = JSON.parse(raw)
      const known = new Set(list.map(panel => panel.id).concat('viewport.canvas'))
      const saved: string[] = (snapshot?.blocks ?? []).map((block: MetaBlockInstance) => block.id)
      if (saved.length && saved.every(id => known.has(id))) {
        workspace.restore(snapshot)
        // The studio has no pop-out windows; a group saved popped out would stay invisible.
        for (const groupId of [...workspace.popouts.keys()]) workspace.reattachPopout(groupId, { area: 'bottom', targetGroupId: workspace.groups.has('dock.bottom') ? 'dock.bottom' : null })
        for (const panel of list) {
          if (workspace.blocks.has(panel.id)) continue
          const groupId = `dock.${panel.dock ?? 'bottom'}`
          const docked = workspace.groups.get(groupId)?.role === 'dock'
          workspace.createMetaBlock({ id: panel.id, title: panel.title, role: 'panel', meta: { description: panel.description ?? null } }, { groupId: docked ? groupId : undefined })
          if (!docked) workspace.floatBlock(panel.id, FLOAT_BOUNDS)
        }
      }
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
    // On <html>, so the kit's portalled lists and HUDs inherit the theme like everything else.
    document.documentElement.dataset.arTheme = ui.theme
  }, [ui.theme])

  // Persist the arrangement once a change settles: drags, resizes and focus clicks stay off localStorage.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      timer = undefined
      if (isResettingLayout()) return
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(workspace.serialize()))
      } catch {
        /* quota or private mode */
      }
    }
    const off = workspace.on('*', (event: { type?: string }) => {
      if (TRANSIENT_EVENTS.has(event?.type ?? '')) return
      clearTimeout(timer)
      timer = setTimeout(save, PERSIST_DELAY_MS)
    })
    // Leaving with a change still pending writes it out.
    const flush = () => timer !== undefined && save()
    window.addEventListener('pagehide', flush)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      off()
    }
  }, [workspace])

  const openPanel = useCallback(
    (id: string) => {
      const panel = byId.get(id)
      if (!panel) return
      if (!workspace.blocks.has(id)) {
        // Back into its dock if there is one, else the first dock, else a floating window.
        const home = [`dock.${panel.dock ?? 'bottom'}`, 'dock.bottom', ...workspace.groups.keys()].find(groupId => workspace.groups.get(groupId)?.role === 'dock')
        workspace.createMetaBlock({ id, title: panel.title, role: 'panel' }, { groupId: home })
        if (!home) workspace.floatBlock(id, FLOAT_BOUNDS)
      }
      workspace.activateBlock(id)
    },
    [byId, workspace],
  )

  // Any reveal — a palette hit, or a panel's own "show in the Inspector" —
  // brings forward the panel that owns the feature at that moment.
  const reveal = useStudio(selectReveal)
  useEffect(() => {
    const feature = reveal && features.find(entry => entry.id === reveal.featureId)
    if (feature) openPanel(panelFor(feature))
  }, [reveal?.at, openPanel])

  // H hides the studio chrome; the scene stays.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || typingTarget(event.target)) return
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
      ...GLASS_THEMES.map(theme => ({ id: `theme.${theme}`, label: `Theme: ${THEME_META[theme].label}`, group: 'View', run: () => studio.setUI({ theme }) })),
      { id: 'reset.all', label: 'Reset every feature', group: 'Features', run: () => studio.resetAll() },
      ...features.flatMap(feature => {
        const group = feature.kind === 'effect' ? 'Effects' : (feature.group ?? 'Features')
        const keywords = `${feature.id} ${feature.category ?? ''} ${feature.path}`
        const show = () => {
          openPanel(panelFor(feature))
          studio.reveal(feature.id)
        }
        return [
          { id: `show.${feature.id}`, label: feature.label, group, keywords: `${keywords} show open`, run: show },
          {
            id: `toggle.${feature.id}`,
            label: `Toggle ${feature.label}`,
            group,
            keywords,
            run: () => studio.setEnabled(feature.id, !studio.getState().features[feature.id]?.enabled),
          },
          { id: `path.${feature.id}`, label: `Copy path · ${feature.path}`, group: 'Source', keywords, run: () => void navigator.clipboard?.writeText(feature.path).catch(() => console.warn(`[studio] Could not copy ${feature.path}`)) },
          // Every control is searchable by name: the hit opens its panel and
          // scrolls the row into view, which is what the per-panel search fields did.
          ...Object.entries(feature.controls ?? {}).map(([name, control]) => ({
            id: `control.${feature.id}.${name}`,
            label: `${feature.label} › ${labelOf(name, control)}`,
            group: 'Controls',
            keywords: `${keywords} ${name} ${control.type}`,
            run: () => {
              openPanel(panelFor(feature))
              studio.reveal(feature.id, name)
            },
          })),
        ]
      }),
    ],
    [openPanel, workspace],
  )

  // One element per block, made once. The workspace re-renders on every focus
  // click, drag frame and resize; handing it the same element each time lets
  // React skip the panel body entirely.
  const bodies = useMemo(() => new Map<string, ReactElement | null>(), [])
  const renderBlock = (block: MetaBlockInstance) => {
    let body = bodies.get(block.id)
    if (body === undefined) {
      body = blockBody(block.id)
      bodies.set(block.id, body)
    }
    return body
  }
  const blockBody = (id: string): ReactElement | null => {
    // R3F sizes its canvas from its parent box; this wrapper gives it a stable full-bleed one.
    if (id === 'viewport.canvas') return <main className="artinos-viewport">{viewport}</main>
    const panel = byId.get(id)
    if (!panel) return null
    const Content = panel.component
    // Keyed by panel, so a tab switch never hands one panel's error state to another.
    return (
      <PanelIdContext key={panel.id} value={panel.id}>
        <div className={`artinos-panel artinos-panel-${panel.id} is-open`}>
          <div className="artinos-panel-body">
            <PanelWorkbench title={panel.title}>
              <Content />
            </PanelWorkbench>
          </div>
        </div>
      </PanelIdContext>
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
        <PanelBarSlot panelId={context.activeBlock?.id ?? null} />
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
        <MetaBlockWorkspaceView workspace={workspace} renderBlock={renderBlock} renderGroupChrome={renderGroupChrome} renderGroupFooter={renderGroupFooter} renderContextMenu={context => <DockMenu {...context} />} padding={10} gap={8} />
        <BrandChip context={byId.get(focused)?.title ?? 'Studio'} />
        <ConsoleToast onOpen={() => openPanel('console')} />
        {!ui.visible && <div className="v2-ui-hint">Press H to show the interface</div>}
      </div>
      <CommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
