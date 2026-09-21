import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Control, ControlValue, DiscoveredFeature } from '../feature'
import { studio, useFeatureState, useStudio, type StudioState } from '../store'
import { PropertyRow } from '../../ui/PropertyRow/PropertyRow'
import { Toggle } from '../../ui/Toggle/Toggle'
import { IconButton } from '../../ui/IconButton/IconButton'
import { ControlInput, labelOf, namesItself } from './ControlField'
import { Icons } from './icons'

export type ControlFilter = 'all' | 'favorites' | 'pinned'

export interface FeatureCardProps {
  feature: DiscoveredFeature
  filter?: ControlFilter
  /** Extra header controls (reorder buttons for effects). */
  extra?: ReactNode
  /** Hide the on/off switch (for always-on hosts). */
  hideSwitch?: boolean
  /** Quiet word before the control count, e.g. the feature group. */
  caption?: string
}

const selectMarks = (state: StudioState) => state.ui
const selectReveal = (state: StudioState) => state.reveal
const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b)

let clipboard: string | null = null

function RowActions({ id, label, marks, onPaste, value }: { id: string; label: string; marks: StudioState['ui']; onPaste: (value: ControlValue) => void; value: ControlValue | undefined }) {
  const favorite = marks.favorites.includes(id)
  const pinned = marks.pins.includes(id)
  return (
    <details className="artinos-property-menu">
      <summary aria-label={`Actions for ${label}`} title={`Actions for ${label}`}>
        ⋯
      </summary>
      <div>
        <IconButton size="sm" active={favorite} label={favorite ? `Unfavorite ${label}` : `Favorite ${label}`} icon={Icons.star} onClick={() => studio.toggleMark('favorites', id)} />
        <IconButton size="sm" active={pinned} label={pinned ? `Unpin ${label}` : `Pin ${label}`} icon={Icons.pin} onClick={() => studio.toggleMark('pins', id)} />
        <IconButton
          size="sm"
          label={`Copy ${label}`}
          icon={Icons.copy}
          onClick={() => {
            clipboard = JSON.stringify({ schema: 'artinos.control-value.v1', value })
            void navigator.clipboard?.writeText(clipboard).catch(() => undefined)
          }}
        />
        <IconButton
          size="sm"
          label={`Paste ${label}`}
          icon={Icons.paste}
          onClick={async () => {
            const raw = (await navigator.clipboard?.readText().catch(() => '')) || clipboard
            try {
              const parsed = raw ? JSON.parse(raw) : null
              if (parsed && 'value' in parsed) onPaste(parsed.value)
            } catch {
              console.warn('[inspector] The clipboard does not hold an ARTINOS control value.')
            }
          }}
        />
      </div>
    </details>
  )
}

/**
 * One feature as an Inspector card: a quiet header (name, control count, switch,
 * reset) over its property rows, laid out by the panel's column flow.
 *
 * Searching happens in the dock's command palette, not here; a palette hit
 * arrives as a `reveal` target, which opens this card and highlights the row.
 */
export const FeatureCard = memo(function FeatureCard({ feature, filter = 'all', extra, hideSwitch = false, caption }: FeatureCardProps) {
  const state = useFeatureState(feature.id)
  const marks = useStudio(selectMarks)
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
    // A revealed control is shown whatever the filter says.
    if (mine?.control === name) return true
    if (control.advanced && !marks.advanced) return false
    const key = `${feature.id}:${name}`
    if (filter === 'favorites' && !marks.favorites.includes(key)) return false
    if (filter === 'pinned' && !marks.pins.includes(key)) return false
    return true
  })
  if (filter !== 'all' && entries.length === 0 && !mine) return null

  const changed = entries.some(([name, control]) => !same(state.values[name], control.value))

  return (
    <div ref={card} className="artinos-parameter-card v2-feature-card" data-enabled={state.enabled || undefined} data-revealed={mine ? '' : undefined}>
      <div className="artinos-parameter-card-head v2-card-head">
        <button type="button" className="v2-card-title" aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)} title={`${feature.description ?? feature.label}\n${feature.path}`}>
          <b>{feature.label}</b>
        </button>
        <small>
          {caption ? `${caption.toUpperCase()} · ` : ''}
          {entries.length || ''}
        </small>
        <span className="v2-card-actions">
          {extra}
          {changed && <IconButton size="sm" label={`Reset ${feature.label}`} icon={Icons.reset} onClick={() => studio.reset(feature.id)} />}
          {!hideSwitch && <Toggle size="sm" label={`${feature.label} enabled`} checked={state.enabled} onChange={enabled => studio.setEnabled(feature.id, enabled)} />}
        </span>
      </div>
      {!collapsed && (
        <div className="artinos-parameter-card-body" data-muted={!state.enabled || undefined}>
          {entries.map(([name, control]: [string, Control], index) => {
            const key = `${feature.id}:${name}`
            const heading = control.group && control.group !== entries[index - 1]?.[1].group ? control.group : null
            const value = state.values[name]
            const set = (next: ControlValue) => studio.setValue(feature.id, name, next)
            return (
              <Fragment key={name}>
              {heading && <div className="v2-control-group">{heading}</div>}
              <PropertyRow
                label={labelOf(name, control)}
                density={namesItself(control) ? 'default' : 'compact'}
                dataControl={name}
                highlighted={mine?.control === name}
                onReset={same(value, control.value) ? undefined : () => set(control.value)}
                actions={<RowActions id={key} label={labelOf(name, control)} marks={marks} value={value} onPaste={set} />}
              >
                <ControlInput name={name} control={control} value={value} onChange={set} />
              </PropertyRow>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
})
