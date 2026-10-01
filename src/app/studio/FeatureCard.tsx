import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Control, ControlValue, DiscoveredFeature } from '../feature'
import { studio, useFeatureState, useStudio, type StudioState } from '../store'
import { PropertyRow } from '../../ui/PropertyRow/PropertyRow'
import { Switch } from '../../ui/Switch/Switch'
import { IconButton } from '../../ui/IconButton/IconButton'
import { ContextMenu, type MenuEntry } from '../../ui/Menu/Menu'
import { ControlInput, labelOf, namesItself } from './ControlField'
import { Icons } from './icons'

export interface FeatureCardProps {
  feature: DiscoveredFeature
  /** Extra header controls (reorder buttons for effects). */
  extra?: ReactNode
  /** Hide the on/off switch (for always-on hosts). */
  hideSwitch?: boolean
  /** Quiet word before the control count, e.g. the feature group. */
  caption?: string
  /** Position in an ordered list (the effect stack), shown as 01, 02 … before the name. */
  ordinal?: number
}

const selectAdvanced = (state: StudioState) => state.ui.advanced
const selectReveal = (state: StudioState) => state.reveal
const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b)

/** Last copied control value, for when the system clipboard cannot be read. */
let clipboard: string | null = null
const SCHEMA = 'artinos.control-value.v1'

/** A row's right-click menu: reset, copy and paste the value. Nothing in the row itself. */
function rowMenu(label: string, value: ControlValue | undefined, fallback: ControlValue, set: (next: ControlValue) => void): MenuEntry[] {
  return [
    { type: 'label', label },
    { id: 'reset', label: 'Reset to default', icon: Icons.reset, disabled: same(value, fallback), onSelect: () => set(fallback) },
    { type: 'separator' },
    {
      id: 'copy',
      label: 'Copy value',
      icon: Icons.copy,
      onSelect: () => {
        clipboard = JSON.stringify({ schema: SCHEMA, value: value ?? fallback })
        void navigator.clipboard?.writeText(clipboard).catch(() => undefined)
      },
    },
    {
      id: 'paste',
      label: 'Paste value',
      icon: Icons.paste,
      onSelect: async () => {
        const raw = (await navigator.clipboard?.readText().catch(() => '')) || clipboard
        try {
          const parsed = raw ? JSON.parse(raw) : null
          // Only a value of the same kind: a colour never lands in a slider.
          if (parsed?.schema === SCHEMA && typeof parsed.value === typeof fallback) set(parsed.value)
        } catch {
          /* not an ARTINOS control value */
        }
      },
    },
  ]
}

/**
 * One feature as an Inspector card: a quiet header (name, control count, switch,
 * reset) over its property rows, laid out by the panel's column flow.
 *
 * Searching happens in the dock's command palette, not here; a palette hit
 * arrives as a `reveal` target, which opens this card and highlights the row.
 */
export const FeatureCard = memo(function FeatureCard({ feature, extra, hideSwitch = false, caption, ordinal }: FeatureCardProps) {
  const state = useFeatureState(feature.id)
  const advanced = useStudio(selectAdvanced)
  const reveal = useStudio(selectReveal)
  const [collapsed, setCollapsed] = useState(false)
  const card = useRef<HTMLDivElement>(null)
  const mine = reveal?.featureId === feature.id ? reveal : null

  useEffect(() => {
    if (!mine) return
    setCollapsed(false)
    const target = mine.control ? card.current?.querySelector(`[data-control="${mine.control}"]`) : null
    ;(target ?? card.current)?.scrollIntoView({ block: 'nearest' })
  }, [mine?.at, mine?.control])

  if (!state) return null

  const entries = Object.entries(feature.controls ?? {}).filter(([name, control]) => {
    // A revealed control is shown even when it is an advanced one.
    if (mine?.control === name) return true
    return !control.advanced || advanced
  })

  const changed = entries.some(([name, control]) => !same(state.values[name], control.value))

  return (
    <div ref={card} className="artinos-parameter-card v2-feature-card" data-enabled={state.enabled || undefined} data-revealed={mine ? '' : undefined}>
      <div className="artinos-parameter-card-head v2-card-head">
        <button type="button" className="v2-card-title" aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)} title={`${feature.description ?? feature.label}\n${feature.path}`}>
          {ordinal !== undefined && <span className="v2-card-ordinal">{String(ordinal).padStart(2, '0')}</span>}
          <b>{feature.label}</b>
        </button>
        <small>
          {caption ? `${caption} · ` : ''}
          {entries.length || ''}
        </small>
        <span className="v2-card-actions">
          {extra}
          {changed && <IconButton size="sm" label={`Reset ${feature.label}`} icon={Icons.reset} onClick={() => studio.reset(feature.id)} />}
          {!hideSwitch && <Switch variant="compact" label={`${feature.label} enabled`} value={state.enabled} onChange={enabled => studio.setEnabled(feature.id, enabled)} />}
        </span>
      </div>
      {!collapsed && (
        <div className="artinos-parameter-card-body" data-muted={!state.enabled || undefined}>
          {entries.map(([name, control]: [string, Control], index) => {
            const heading = control.group && control.group !== entries[index - 1]?.[1].group ? control.group : null
            const value = state.values[name]
            const set = (next: ControlValue) => studio.setValue(feature.id, name, next)
            return (
              <Fragment key={name}>
              {heading && <div className="v2-control-group">{heading}</div>}
              <ContextMenu items={() => rowMenu(labelOf(name, control), value, control.value, set)}>
                <PropertyRow
                  label={labelOf(name, control)}
                  density={namesItself(control) ? 'default' : 'compact'}
                  dataControl={name}
                  highlighted={mine?.control === name}
                  modified={!same(value, control.value)}
                >
                  <ControlInput name={name} control={control} value={value} onChange={set} />
                </PropertyRow>
              </ContextMenu>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
})
