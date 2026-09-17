import { useMemo, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { byKind, findFeature } from '../app/registry'
import { studio, useStudio, type StudioState } from '../app/store'
import { useRuntime } from '../app/runtime'
import { FeatureCard } from '../app/studio/FeatureCard'
import { ControlInput, labelOf } from '../app/studio/ControlField'
import { Icons } from '../app/studio/icons'
import { TextField } from '../ui/TextField/TextField'
import { Select } from '../ui/Select/Select'
import { Segmented } from '../ui/Segmented/Segmented'
import { Toggle } from '../ui/Toggle/Toggle'
import { IconButton } from '../ui/IconButton/IconButton'
import { PropertyRow } from '../ui/PropertyRow/PropertyRow'
import type { DiscoveredFeature } from '../app/feature'

const effects = byKind('effect')
const CATEGORIES = ['all', 'light', 'lens', 'color', 'blur', 'stylize', 'temporal', 'screen-space', 'anti-aliasing'] as const
const selectFeatures = (state: StudioState) => state.features
const words = (value: string) => value.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** One effect in the browser: switch, name, category · cost, expandable controls. */
function EffectRow({ effect }: { effect: DiscoveredFeature }) {
  const states = useStudio(selectFeatures)
  const state = states[effect.id]
  const [open, setOpen] = useState(false)
  if (!state) return null
  const controls = Object.entries(effect.controls ?? {})
  return (
    <div className={`artinos-effect ${state.enabled ? 'is-enabled' : ''}`}>
      <div className="artinos-effect-head">
        <button type="button" className="artinos-effect-expand" aria-expanded={open} onClick={() => setOpen(value => !value)} title={effect.path}>
          <span className="artinos-effect-name">
            <b>{effect.label}</b> <small>{words(effect.category ?? '')}</small>
          </span>
          <span className="artinos-effect-cost">
            {effect.cost}
            {effect.webgpuOnly ? ' · WebGPU' : ''}
          </span>
          {controls.length > 0 && Icons.chevronDown}
        </button>
        <Toggle size="sm" label={`${effect.label} enabled`} checked={state.enabled} onChange={value => studio.setEnabled(effect.id, value)} />
      </div>
      {open && (
        <div className="artinos-effect-body">
          {controls.length === 0 && <div className="artinos-effect-status">No settings.</div>}
          {controls.map(([name, control]) => (
            <PropertyRow key={name} label={labelOf(name, control)} density={control.type === 'number' ? 'default' : 'compact'}>
              <ControlInput name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(effect.id, name, value)} />
            </PropertyRow>
          ))}
        </div>
      )}
    </div>
  )
}

function PostFX() {
  const states = useStudio(selectFeatures)
  const host = findFeature('postfx')
  const [view, setView] = useState<'stack' | 'browse'>('stack')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all')
  const needle = query.trim().toLowerCase()

  const active = useMemo(
    () =>
      effects
        .filter(effect => states[effect.id]?.enabled)
        .sort((a, b) => (states[a.id]?.order ?? a.order ?? 500) - (states[b.id]?.order ?? b.order ?? 500)),
    [states],
  )
  const browse = effects.filter(effect => (category === 'all' || effect.category === category) && (!needle || `${effect.label} ${effect.category}`.toLowerCase().includes(needle)))
  const bypassed = host ? !states[host.id]?.enabled : true

  return (
    <div className="artinos-panel-suite">
      <div className="artinos-postfx-commandbar v2-panel-bar">
        <Segmented
          size="sm"
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'stack', label: `Stack · ${active.length}` },
            { value: 'browse', label: `Browse · ${effects.length}` },
          ]}
        />
        {view === 'browse' && (
          <>
            <TextField type="search" size="sm" value={query} onChange={setQuery} label="Search effects" placeholder="Search effects" />
            <Select size="sm" label="Category" value={category} onChange={setCategory} options={CATEGORIES.map(value => ({ value, label: value === 'all' ? 'All categories' : words(value) }))} />
          </>
        )}
        <span className="v2-spacer" />
        {host && (
          <label className="v2-inline-toggle">
            Pipeline
            <Toggle size="sm" label="Post-processing enabled" checked={!bypassed} onChange={value => studio.setEnabled(host.id, value)} />
          </label>
        )}
      </div>

      {bypassed && <div className="artinos-panel-notice">Post-processing is bypassed. Effects keep their settings.</div>}

      {view === 'stack' ? (
        active.length === 0 ? (
          <div className="v2-empty">No active effects. Switch to Browse to add some.</div>
        ) : (
          <div className="artinos-parameter-cards">
            {active.map((effect, index) => (
              <FeatureCard
                key={effect.id}
                feature={effect}
                extra={
                  <>
                    <IconButton size="sm" label={`Move ${effect.label} earlier`} icon={Icons.up} disabled={index === 0} onClick={() => studio.moveEffect(effect.id, -1)} />
                    <IconButton size="sm" label={`Move ${effect.label} later`} icon={Icons.down} disabled={index === active.length - 1} onClick={() => studio.moveEffect(effect.id, 1)} />
                  </>
                }
              />
            ))}
          </div>
        )
      ) : (
        <div className="artinos-postfx-grid">
          {browse.map(effect => (
            <EffectRow key={effect.id} effect={effect} />
          ))}
          {browse.length === 0 && <div className="v2-empty">No effect matches.</div>}
        </div>
      )}
    </div>
  )
}

function PostFXFooter() {
  const { backend } = useRuntime()
  return <>{backend ? backend.toUpperCase() : 'GPU'} · TSL RENDER PIPELINE</>
}

export default PostFX

export const panel: PanelManifest = {
  id: 'postfx',
  title: 'PostFX',
  description: 'Post-processing stack and per-effect controls',
  keywords: ['bloom', 'effects', 'post', 'grading', 'anti-aliasing'],
  order: 2,
  footer: PostFXFooter,
  component: PostFX,
}
