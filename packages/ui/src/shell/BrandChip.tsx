import { usePanelHost } from './panel-host'
import { useWorkspaceLayout } from './workspace-context'
import type { EdgeDock } from './panel-types'

/**
 * Brand chip (reference SH.01).
 *
 * It floats over the canvas at the top-left — it is not part of the dock strip.
 * The strip is for panel selection, search and controls; the chip is identity
 * and context, and it sits on the scene where the reference puts it.
 */
export function BrandChip({ context }: { context?: string }) {
  const host = usePanelHost()
  const { layout } = useWorkspaceLayout()
  const activeDock: EdgeDock = layout.leftOpen ? 'left' : layout.rightOpen ? 'right' : 'bottom'

  const focused = host.definitions.find(definition => {
    const state = host.get(definition.id)
    return state?.dock === activeDock && state?.visible !== false && state?.open !== false
  })

  return <BrandChipView context={context ?? (focused ? focused.title : 'Studio')} />
}

/**
 * The chip without its data source. `BrandChip` reads the classic panel host; shells built on a
 * different layout engine (see `MetaBlockShell`) resolve the context line themselves and render
 * this directly, so the mark stays identical across both without either shell's state leaking
 * into the other.
 */
export function BrandChipView({ context = 'Studio' }: { context?: string }) {
  return (
    <div className="plate-brand-chip">
      <span className="plate-brand-mark" aria-hidden>
        #
      </span>
      <b>ARTINOS</b>
      <i aria-hidden />
      <span className="plate-brand-context">{context}</span>
    </div>
  )
}
