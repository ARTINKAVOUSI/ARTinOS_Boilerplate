import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useShortcut } from '../headless'
import { CommandPalette } from './CommandPalette'
import { registerCommandSource, type CommandItem } from './command-registry'
import { DockArea } from './DockArea'
import { BrandChip } from './BrandChip'
import { DockToolbar } from './DockToolbar'
import { PanelFrame, DockDropZone } from './PanelFrame'
import { PanelHostProvider, usePanelHost } from './panel-host'
import { PanelRail } from './PanelRail'
import { panelsInDock } from './panel-layout'
import { Workspace, ViewportSlot } from './workspace-context'
import type { Dock, PanelDefinition } from './panel-types'

export interface PanelWorkspaceProps {
  panels: PanelDefinition[]
  viewport: ReactNode
  persistKey?: string
  statusOverlay?: ReactNode
  /** Rendered in the toolbar beside the dock controls. */
  toolbarStatus?: ReactNode
}

/**
 * The full editor shell: viewport, three edge docks, floating panels, rail, toolbar and
 * command palette.
 *
 * State lives in `PanelHostProvider`; this component only decides what renders where.
 */
export function PanelWorkspace({ panels, viewport, persistKey = 'artinos.panels', statusOverlay, toolbarStatus }: PanelWorkspaceProps) {
  return (
    <PanelHostProvider definitions={panels} persistKey={persistKey}>
      <PanelWorkspaceSurface viewport={viewport} persistKey={persistKey} statusOverlay={statusOverlay} toolbarStatus={toolbarStatus} />
    </PanelHostProvider>
  )
}

function PanelWorkspaceSurface({ viewport, persistKey, statusOverlay, toolbarStatus }: { viewport: ReactNode; persistKey: string; statusOverlay?: ReactNode; toolbarStatus?: ReactNode }) {
  const host = usePanelHost()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  useShortcut(useMemo(() => ({ key: 'k', meta: true }), []), openPalette)

  // Panels are searchable the moment they are declared — no separate registration step.
  useEffect(
    () =>
      registerCommandSource({
        id: 'panels',
        collect: () =>
          host.definitions.map<CommandItem>(definition => {
            const state = host.layout[definition.id]
            const shown = Boolean(state?.visible)
            return {
              id: `panel:${definition.id}`,
              title: definition.title,
              subtitle: shown ? `visible · ${state?.dock}` : 'hidden',
              group: 'Panels',
              keywords: `panel ${definition.id} ${definition.keywords?.join(' ') ?? ''} ${definition.description ?? ''}`,
              icon: definition.icon,
              hint: shown ? 'focus' : 'open',
              run: () => {
                host.show(definition.id)
                host.focus(definition.id)
              },
            }
          }),
      }),
    [host],
  )

  const known = useMemo(() => new Set(host.definitions.map(definition => definition.id)), [host.definitions])
  const byId = useMemo(() => new Map(host.definitions.map(definition => [definition.id, definition])), [host.definitions])

  const render = (dock: Dock) =>
    panelsInDock(host.layout, dock, known).map(id => <PanelFrame key={id} definition={byId.get(id)!} state={host.layout[id]} />)

  const chrome = <DockToolbar onSearch={openPalette} status={toolbarStatus} />

  return (
    <>
      <Workspace persistKey={`${persistKey}.docks`}>
        <ViewportSlot>
          {viewport}
          {render('float')}
        </ViewportSlot>
        <DockArea dock="left" chrome={chrome} rail={<PanelRail dock="left" />}>
          <DockDropZone dock="left" />
          {render('left')}
          
        </DockArea>
        <DockArea dock="right" chrome={chrome} rail={<PanelRail dock="right" />}>
          <DockDropZone dock="right" />
          {render('right')}
          
        </DockArea>
        <DockArea dock="bottom" chrome={chrome}>
          {render('bottom')}
        </DockArea>
        <BrandChip />
        {statusOverlay}
      </Workspace>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
