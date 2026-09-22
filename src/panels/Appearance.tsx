import type { PanelManifest } from '../app/panel'
import { studio, useStudio, type StudioState } from '../app/store'
import { resetDockLayout } from '../app/studio/layout'
import { PropertyRow } from '../ui/PropertyRow/PropertyRow'
import { Segmented } from '../ui/Segmented/Segmented'
import { Toggle } from '../ui/Toggle/Toggle'
import { Button } from '../ui/Button/Button'
import { Kbd } from '../ui/Kbd/Kbd'

const WORLDS = [
  { value: 'clear', label: 'Clear', note: 'highest transmission, lightest mass' },
  { value: 'frost', label: 'Frost', note: 'the canonical surface' },
  { value: 'satin', label: 'Satin', note: 'silkier, porcelain active regions' },
  { value: 'graphite', label: 'Graphite', note: 'smoked, for long sessions and bright scenes' },
  { value: 'opal', label: 'Opal', note: 'chalk and mineral, carved controls' },
  { value: 'monolith', label: 'Monolith', note: 'densest body' },
] as const
const selectUI = (state: StudioState) => state.ui

function Appearance() {
  const ui = useStudio(selectUI)
  const current = WORLDS.find(world => world.value === ui.world) ?? WORLDS[1]
  return (
    <div className="artinos-panel-suite">
      <div className="artinos-parameter-cards">
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Material world</b>
            <small>{current.note}</small>
          </div>
          <Segmented label="Material world" value={current.value} onChange={world => studio.setUI({ world })} options={WORLDS.map(({ value, label }) => ({ value, label }))} />
        </div>
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Interface</b>
          </div>
          <PropertyRow label="Show chrome" density="compact">
            <Toggle size="sm" label="Show interface" checked={ui.visible} onChange={visible => studio.setUI({ visible })} />
          </PropertyRow>
          <PropertyRow label="Shortcuts" density="compact">
            <span style={{ display: 'flex', gap: 10, fontSize: 10, opacity: 0.7 }}>
              <span>
                <Kbd keys={['H']} /> hide
              </span>
              <span>
                <Kbd keys={['mod', 'K']} /> search
              </span>
            </span>
          </PropertyRow>
        </div>
        <div className="artinos-parameter-card">
          <div className="artinos-parameter-card-head">
            <b>Layout</b>
            <small>drag tabs out to float, split or re-dock</small>
          </div>
          <div className="v2-panel-bar" style={{ margin: 0 }}>
            <Button size="sm" onClick={resetDockLayout}>
              Reset dock layout
            </Button>
            <Button size="sm" variant="danger" onClick={() => studio.resetAll()}>
              Reset every feature
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Appearance

export const panel: PanelManifest = {
  id: 'appearance',
  title: 'Appearance',
  description: 'Material world, interface and layout',
  keywords: ['theme', 'world', 'glass', 'layout', 'reset'],
  order: 12,
  footer: () => <>UI · WORLDS</>,
  component: Appearance,
}
