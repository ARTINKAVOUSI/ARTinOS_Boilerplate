import { useMemo } from 'react'
import { byKind, findFeature } from '../registry'
import { studio, useStudio, type StudioState } from '../store'
import { Panel } from '../../ui/Panel/Panel'
import { Toggle } from '../../ui/Toggle/Toggle'
import { Menu, type MenuEntry } from '../../ui/Menu/Menu'
import { Button } from '../../ui/Button/Button'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Badge } from '../../ui/Badge/Badge'
import { FeatureSection } from './FeatureSection'
import { Icons } from './icons'

const effects = byKind('effect')
const host = findFeature('postfx')
const CATEGORY_ORDER = ['light', 'lens', 'color', 'blur', 'stylize', 'temporal', 'screen-space', 'anti-aliasing']
const selectFeatures = (state: StudioState) => state.features

const words = (s: string) => s.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** The right panel: the live effect chain, in pipeline order, and a browser to add more. */
export function PostFXPanel({ onClose }: { onClose?: () => void }) {
  const states = useStudio(selectFeatures)
  const pipelineOn = host ? states[host.id]?.enabled : false

  const active = useMemo(
    () =>
      effects
        .filter(effect => states[effect.id]?.enabled)
        .sort((a, b) => (states[a.id]?.order ?? a.order ?? 500) - (states[b.id]?.order ?? b.order ?? 500)),
    [states],
  )

  const addItems = useMemo<MenuEntry[]>(() => {
    const entries: MenuEntry[] = []
    for (const category of CATEGORY_ORDER) {
      const available = effects.filter(effect => effect.category === category && !states[effect.id]?.enabled)
      if (!available.length) continue
      entries.push({ type: 'label', label: words(category) })
      for (const effect of available) {
        entries.push({
          id: effect.id,
          label: effect.label,
          shortcut: [effect.cost, effect.webgpuOnly ? 'WebGPU' : ''].filter(Boolean).join(' · '),
          onSelect: () => studio.setEnabled(effect.id, true),
        })
      }
    }
    return entries
  }, [states])

  if (!host) {
    return (
      <Panel title="Post FX" className="studio-panel">
        <div className="studio-note">The pipeline host (src/features/postfx/PostFX.tsx) is not present.</div>
      </Panel>
    )
  }

  return (
    <Panel
      title="Post FX"
      subtitle={`${active.length} active · ${effects.length} available`}
      className="studio-panel"
      status={pipelineOn && active.length ? 'live' : undefined}
      actions={
        <>
          <Toggle size="sm" label="Post-processing enabled" checked={Boolean(pipelineOn)} onChange={value => studio.setEnabled(host.id, value)} />
          {onClose && (
            <button type="button" className="studio-close" aria-label="Close post FX panel" onClick={onClose}>
              ×
            </button>
          )}
        </>
      }
      toolbar={
        <Menu
          align="end"
          items={addItems.length ? addItems : [{ type: 'label', label: 'Every effect is active' }]}
          trigger={
            <Button size="sm" block icon={Icons.plus} disabled={!pipelineOn}>
              Add effect
            </Button>
          }
        />
      }
      footer={<span>Chain runs top → bottom. Scene passes (SSAA, Pixelation) replace the input.</span>}
    >
      {!pipelineOn && <div className="studio-note">Post-processing is bypassed.</div>}
      {pipelineOn && active.length === 0 && <div className="studio-note">No effects. Add one above.</div>}
      {pipelineOn &&
        active.map((effect, index) => (
          <FeatureSection
            key={effect.id}
            feature={effect}
            meta={
              <>
                {effect.cost && effect.cost !== 'low' && <Badge tone={effect.cost === 'very-high' ? 'danger' : effect.cost === 'high' ? 'warm' : 'neutral'}>{effect.cost}</Badge>}
                {effect.webgpuOnly && <Badge>WebGPU</Badge>}
              </>
            }
            extraActions={
              <>
                <IconButton size="sm" label={`Move ${effect.label} earlier`} icon={Icons.up} disabled={index === 0} onClick={() => studio.moveEffect(effect.id, -1)} />
                <IconButton size="sm" label={`Move ${effect.label} later`} icon={Icons.down} disabled={index === active.length - 1} onClick={() => studio.moveEffect(effect.id, 1)} />
              </>
            }
          />
        ))}
    </Panel>
  )
}
