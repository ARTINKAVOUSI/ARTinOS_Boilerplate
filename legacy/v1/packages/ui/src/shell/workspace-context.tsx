import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePersistentState, usePersistentValue } from '../headless'

export interface WorkspaceLayout {
  left: number
  right: number
  bottom: number
  leftOpen: boolean
  rightOpen: boolean
  bottomOpen: boolean
}

export type WorkspaceTheme = 'auto' | 'workbench' | 'glass' | 'dark' | 'light'
export type Backdrop = 'bright' | 'dark'

const DEFAULT_LAYOUT: WorkspaceLayout = { left: 424, right: 424, bottom: 276, leftOpen: false, rightOpen: false, bottomOpen: true }

const LayoutContext = createContext<{ layout: WorkspaceLayout; setLayout(patch: Partial<WorkspaceLayout>): void } | null>(null)
const ThemeContext = createContext<{ theme: WorkspaceTheme; setTheme(theme: WorkspaceTheme): void; backdrop: Backdrop } | null>(null)

export function useWorkspaceLayout() {
  const context = useContext(LayoutContext)
  if (!context) throw new Error('useWorkspaceLayout requires <Workspace>')
  return context
}

export function useWorkspaceTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useWorkspaceTheme requires <Workspace>')
  return context
}

function parseTheme(raw: string): WorkspaceTheme | null {
  // `glass` predates the workbench look and now resolves to it.
  if (raw === 'glass') return 'workbench'
  return raw === 'workbench' || raw === 'dark' || raw === 'light' || raw === 'auto' ? raw : null
}

/** Portable auto-contrast fallback. A graphics host may style `data-backdrop`
 * from its own semantic luminance signal without the shell sampling a canvas. */
function useAdaptiveBackdrop(active: boolean, _region: Pick<WorkspaceLayout, 'leftOpen' | 'rightOpen' | 'bottomOpen'>): Backdrop {
  const [backdrop, setBackdrop] = useState<Backdrop>('bright')
  useEffect(() => {
    if (!active) return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setBackdrop(media.matches ? 'dark' : 'bright')
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [active])

  return backdrop
}

/** Root workspace grid: owns dock sizes, theme and the adaptive backdrop. */
export function Workspace({ children, persistKey = 'artinos.workspace' }: { children: ReactNode; persistKey?: string }) {
  const [layout, setLayout] = usePersistentState<WorkspaceLayout>(persistKey, DEFAULT_LAYOUT)
  // The workbench glass is the default: the scene reads through the chrome.
  // `auto` tints toward opacity to guarantee contrast on any backdrop, which is
  // the safer default but not the intended one.
  const [theme, setTheme] = usePersistentValue<WorkspaceTheme>(`${persistKey}.theme`, 'workbench', parseTheme)
  const backdrop = useAdaptiveBackdrop(theme === 'auto', layout)

  const layoutValue = useMemo(() => ({ layout, setLayout }), [layout, setLayout])
  const themeValue = useMemo(() => ({ theme, setTheme, backdrop }), [theme, setTheme, backdrop])

  return (
    <LayoutContext.Provider value={layoutValue}>
      <ThemeContext.Provider value={themeValue}>
        <div
          className="artinos-workspace plate-workspace artinos-root"
          data-theme={theme}
          data-backdrop={backdrop}
          style={
            {
              '--left-width': `${layout.left}px`,
              '--right-width': `${layout.right}px`,
              '--bottom-height': `${layout.bottom}px`,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </ThemeContext.Provider>
    </LayoutContext.Provider>
  )
}

export function ViewportSlot({ children }: { children: ReactNode }) {
  return <main className="artinos-viewport">{children}</main>
}
