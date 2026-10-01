import { useEffect, useRef, useState } from 'react'
import type { DiscoveredFeature } from '../feature'
import { studio, useFeatureState, useStudio, type StudioState } from '../store'
import { PropertyRow } from '../../ui/PropertyRow/PropertyRow'
import { Switch } from '../../ui/Switch/Switch'
import { ControlInput, labelOf, namesItself } from './ControlField'
import { Icons } from './icons'

export interface FeatureTileProps {
  feature: DiscoveredFeature
  /** The quiet line under the name. Defaults to the feature's description. */
  caption?: string
  /** Whether the switch shows on. Defaults to the feature's enabled state. */
  on?: boolean
  /** A word beside the name, e.g. Live or Ready. */
  state?: { label: string; live?: boolean }
  /** What the switch does. Defaults to switching the feature on or off. */
  onToggle?: (on: boolean) => void
}

const selectReveal = (state: StudioState) => state.reveal
const selectAdvanced = (state: StudioState) => state.ui.advanced

/**
 * One feature as a compact tile: name, status and switch on one line, a caption
 * under it, and its controls folded away until asked for. The catalogue form of
 * a FeatureCard — for lists where most entries are off (effects, devices).
 */
export function FeatureTile({ feature, caption, on, state: status, onToggle }: FeatureTileProps) {
  const state = useFeatureState(feature.id)
  const reveal = useStudio(selectReveal)
  const advanced = useStudio(selectAdvanced)
  const [open, setOpen] = useState(false)
  const tile = useRef<HTMLDivElement>(null)
  const mine = reveal?.featureId === feature.id ? reveal : null

  // Opened from the command palette: unfold and bring it into view.
  useEffect(() => {
    if (!mine) return
    setOpen(true)
    tile.current?.scrollIntoView({ block: 'nearest' })
  }, [mine?.at])

  if (!state) return null
  const enabled = on ?? state.enabled
  const controls = Object.entries(feature.controls ?? {}).filter(([name, control]) => !control.advanced || advanced || mine?.control === name)
  return (
    <div ref={tile} className="v2-tile" data-enabled={enabled || undefined}>
      <span className="v2-tile__name" title={feature.path}>
        <span>{feature.label}</span>
        {status && (
          <em className="v2-state" data-tone={status.live ? 'live' : undefined}>
            {status.label}
          </em>
        )}
      </span>
      <small title={caption ?? feature.description}>{caption ?? feature.description}</small>
      <span className="v2-tile__end">
        {controls.length > 0 && (
          <button type="button" className="v2-tile__fold" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} ${feature.label} settings`} title="Settings" onClick={() => setOpen(value => !value)}>
            {Icons.chevronDown}
          </button>
        )}
        <Switch variant="compact" label={`${feature.label} enabled`} value={enabled} onChange={value => (onToggle ? onToggle(value) : studio.setEnabled(feature.id, value))} />
      </span>
      {open && controls.length > 0 && (
        <div className="v2-tile__body">
          {controls.map(([name, control]) => (
            <PropertyRow key={name} label={labelOf(name, control)} density={namesItself(control) ? 'default' : 'compact'} dataControl={name} highlighted={mine?.control === name}>
              <ControlInput name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(feature.id, name, value)} />
            </PropertyRow>
          ))}
        </div>
      )}
    </div>
  )
}
