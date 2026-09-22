import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { DockControls } from './DockControls'
import { DockTabs } from './DockTabs'
import { usePanelHost } from './panel-host'
import { useWorkspaceLayout } from './workspace-context'
import type { EdgeDock } from './panel-types'

/**
 * The tab strip (reference SH.01): brand chip, panel tabs, search, controls.
 *
 * Everything that is not panel selection or search lives in one collapsed
 * `DockControls`, so the strip reads as four regions rather than a row of
 * competing icon clusters.
 *
 * `status` renders beside the controls. The shell knows nothing about a runtime, so
 * the host passes its own readout (the studio passes its runtime HUD).
 */
export function DockToolbar({ onSearch, status }: { onSearch(): void; status?: ReactNode }) {
  const { layout } = useWorkspaceLayout()
  const activeDock: EdgeDock = layout.leftOpen ? 'left' : layout.rightOpen ? 'right' : 'bottom'

  return (
    <header className="plate-dock-toolbar">
      {/* SH.01: the strip only exists on the horizontal axis. On a side dock the
          rail is the selector, and rendering both would be two controls for one job. */}
      {activeDock === 'bottom' && <DockTabs dock={activeDock} />}

      <button className="plate-search-entry" onClick={onSearch} title="Search everything (Ctrl/Cmd + K)">
        <Search size={12} />
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="plate-toolbar-cluster">
        {status && <div className="plate-toolbar-status">{status}</div>}
        <DockControls />
      </div>
    </header>
  )
}

/** Standalone dock visibility toggles, for shells without the full toolbar. */
export function WorkspaceChrome() {
  const { layout, setLayout } = useWorkspaceLayout()
  return (
    <div className="artinos-workspace-chrome">
      <button className={layout.leftOpen ? 'is-active' : ''} onClick={() => setLayout({ leftOpen: !layout.leftOpen })}>
        LEFT
      </button>
      <button className={layout.bottomOpen ? 'is-active' : ''} onClick={() => setLayout({ bottomOpen: !layout.bottomOpen })}>
        BOTTOM
      </button>
      <button className={layout.rightOpen ? 'is-active' : ''} onClick={() => setLayout({ rightOpen: !layout.rightOpen })}>
        RIGHT
      </button>
    </div>
  )
}
