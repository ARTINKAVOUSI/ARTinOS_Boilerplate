import { memo, type ReactNode } from 'react'
import type { DiscoveredFeature } from '../feature'
import { studio, useFeatureState } from '../store'
import { Section } from '../../ui/Section/Section'
import { Toggle } from '../../ui/Toggle/Toggle'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Tooltip } from '../../ui/Tooltip/Tooltip'
import { ControlField } from './ControlField'
import { Icons } from './icons'

export interface FeatureSectionProps {
  feature: DiscoveredFeature
  /** Extra header controls (reorder buttons for effects). */
  extraActions?: ReactNode
  meta?: ReactNode
  defaultOpen?: boolean
}

/** One feature in a panel: its on/off switch, reset, and every control. */
export const FeatureSection = memo(function FeatureSection({ feature, extraActions, meta, defaultOpen = false }: FeatureSectionProps) {
  const state = useFeatureState(feature.id)
  if (!state) return null
  const controls = Object.entries(feature.controls ?? {})
  return (
    <Section
      title={
        <Tooltip content={<>{feature.description ?? feature.label}<br /><span style={{ opacity: 0.55 }}>{feature.path}</span></>}>
          <span>{feature.label}</span>
        </Tooltip>
      }
      meta={meta}
      defaultOpen={defaultOpen && state.enabled}
      muted={!state.enabled}
      actions={
        <>
          {extraActions}
          {controls.length > 0 && <IconButton size="sm" label={`Reset ${feature.label}`} icon={Icons.reset} onClick={() => studio.reset(feature.id)} />}
          <Toggle size="sm" label={`${feature.label} enabled`} checked={state.enabled} onChange={enabled => studio.setEnabled(feature.id, enabled)} />
        </>
      }
    >
      {controls.length === 0 && <div className="studio-note">No settings.</div>}
      {controls.map(([name, control]) => (
        <ControlField key={name} name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(feature.id, name, value)} />
      ))}
    </Section>
  )
})
