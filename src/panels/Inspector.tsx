import { useEffect, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import type { FeatureInspector, Values } from '../app/feature'
import { features, findFeature, inspectors } from '../app/registry'
import { effectOrder, studio, useFeatureState, useStudio, type StudioState } from '../app/store'
import { catalogue, sectionOf, shelfLabel, type SectionId } from '../app/studio/catalogue'
import { CardFlow } from '../app/studio/CardFlow'
import { FeatureCard } from '../app/studio/FeatureCard'
import { Icons } from '../app/studio/icons'
import { PanelBar } from '../app/studio/PanelBar'
import { IconButton } from '../ui/IconButton/IconButton'
import { Segmented } from '../ui/Segmented/Segmented'
import { Switch } from '../ui/Switch/Switch'

/*
 * The Inspector: the parameters of everything on the canvas, and nothing else.
 * Cards run in the catalogue's section order — objects, scene, effects (in
 * chain order, reorderable), input, overlays — captioned with where the
 * Library lists them, and the bar narrows to one section. A feature folder's
 * own studio section rides inside its card. Switching a component off takes
 * it out; the Library adds it back.
 */

/** What is on, with the effect chain's order: the panel re-renders when either changes, never on a slider step. */
const selectActive = (state: StudioState) =>
  features
    .filter(feature => state.features[feature.id]?.enabled)
    .map(feature => (feature.kind === 'effect' ? `${feature.id}@${effectOrder(feature.id, state.features)}` : feature.id))
    .join(' ')
const selectReveal = (state: StudioState) => state.reveal
const hosts = features.filter(feature => feature.kind === 'canvas-provider')

const NO_VALUES: Values = {}
// Stable, so a section re-renders for its own values; the panel re-renders it when any switch changes.
const peer = (id: string) => (findFeature(id) ? { enabled: !!studio.getState().features[id]?.enabled } : undefined)
const setEnabled = (id: string, enabled: boolean) => studio.setEnabled(id, enabled)

/** A studio section a feature folder ships for itself (the glass diagnostics, the room). */
function InspectorSection({ inspector, target }: { inspector: FeatureInspector; target: string }) {
  const state = useFeatureState(target)
  return <inspector.component featureId={target} values={state?.values ?? NO_VALUES} peer={peer} setEnabled={setEnabled} />
}

/** The pipeline host's switch, on the Effects heading: off bypasses every effect. */
function PipelineToggle({ id, label }: { id: string; label: string }) {
  const state = useFeatureState(id)
  if (!state) return null
  return (
    <label className="v2-inline-toggle" title={state.enabled ? 'Effects run in the order listed' : 'Bypassed: effects keep their settings'}>
      Pipeline
      <Switch variant="compact" label={`${label} enabled`} value={state.enabled} onChange={value => studio.setEnabled(id, value)} />
    </label>
  )
}

function Inspector() {
  useStudio(selectActive)
  const states = studio.getState().features
  const reveal = useStudio(selectReveal)
  const [focus, setFocus] = useState<'all' | SectionId>('all')

  // A feature folder's own section rides in the card of the first of its features that is on,
  // so it shows, folds and goes away with that component.
  const extraFor = new Map<string, FeatureInspector>()
  for (const inspector of inspectors) {
    const target = inspector.features.find(id => findFeature(id) && states[id]?.enabled)
    if (target && !extraFor.has(target)) extraFor.set(target, inspector)
  }
  const extra = (id: string) => {
    const inspector = extraFor.get(id)
    return inspector ? <InspectorSection inspector={inspector} target={id} /> : null
  }

  const groups = catalogue
    .map(section => {
      const cards = section.features.filter(feature => feature.kind !== 'canvas-provider' && states[feature.id]?.enabled)
      if (section.id === 'effects') cards.sort((a, b) => effectOrder(a.id, states) - effectOrder(b.id, states))
      return { section, cards }
    })
    .filter(group => group.cards.length)

  const total = groups.reduce((sum, group) => sum + group.cards.length, 0)
  // A focus on a section that has just emptied falls back to everything.
  const current = groups.some(group => group.section.id === focus) ? focus : 'all'
  const shown = current === 'all' ? groups : groups.filter(group => group.section.id === current)
  const bypassed = hosts.some(host => !states[host.id]?.enabled)
  const sectionOptions = [{ value: 'all', label: `All · ${total}` }, ...groups.map(group => ({ value: group.section.id, label: `${group.section.label} · ${group.cards.length}` }))]

  // A palette jump to a component in another section shows everything again.
  useEffect(() => {
    const feature = reveal && findFeature(reveal.featureId)
    if (feature && current !== 'all' && sectionOf(feature) !== current) setFocus('all')
  }, [reveal?.at])

  if (groups.length === 0) {
    return (
      <div className="artinos-panel-suite">
        <div className="v2-empty">
          <b>Nothing on the canvas</b>
          Add objects, scene settings, effects or input from the Library; their parameters appear here.
        </div>
      </div>
    )
  }

  const effectsShown = shown.some(group => group.section.id === 'effects')

  // One packed flow, in section order, each card captioned with where it sits:
  // a section per row would strand a tall card beside an empty dock.
  return (
    <div className="artinos-panel-suite artinos-inspector-suite">
      <PanelBar>
        <Segmented
          label="Section"
          value={current}
          onChange={value => setFocus(value as 'all' | SectionId)}
          options={sectionOptions}
          // Segments share the width equally, so give each room for the longest label.
          style={{ minWidth: `min(${sectionOptions.length * 96}px, 100%)` }}
        />
        {effectsShown && hosts.map(host => <PipelineToggle key={host.id} id={host.id} label={host.label} />)}
        <span className="v2-spacer" />
        <span className="v2-bar-summary">{total} active · right-click a row to reset, copy or paste</span>
      </PanelBar>

      {effectsShown && bypassed && <div className="artinos-panel-notice">The pipeline is bypassed. Effects keep their settings.</div>}

      <CardFlow>
        {shown.flatMap(({ section, cards }) =>
          cards.map((feature, index) => {
            const caption = section.shelves.length > 1 ? `${section.label} · ${shelfLabel(feature)}` : section.label
            return section.id === 'effects' ? (
              <FeatureCard
                key={feature.id}
                feature={feature}
                ordinal={index + 1}
                caption={caption}
                extra={
                  <>
                    <IconButton size="sm" label={`Move ${feature.label} earlier`} icon={Icons.up} disabled={index === 0} onClick={() => studio.moveEffect(feature.id, -1)} />
                    <IconButton size="sm" label={`Move ${feature.label} later`} icon={Icons.down} disabled={index === cards.length - 1} onClick={() => studio.moveEffect(feature.id, 1)} />
                  </>
                }
              >
                {extra(feature.id)}
              </FeatureCard>
            ) : (
              <FeatureCard key={feature.id} feature={feature} caption={caption}>
                {extra(feature.id)}
              </FeatureCard>
            )
          }),
        )}
      </CardFlow>
    </div>
  )
}

const selectCount = (state: StudioState) => features.filter(feature => feature.kind !== 'canvas-provider' && state.features[feature.id]?.enabled).length

function InspectorFooter() {
  const count = useStudio(selectCount)
  return <>{count} ACTIVE · PARAMETERS</>
}

export default Inspector

export const panel: PanelManifest = {
  id: 'inspector',
  title: 'Inspector',
  description: 'The parameters of every component on the canvas',
  keywords: ['parameters', 'controls', 'properties', 'active', 'stack', 'effects', 'order'],
  order: 0,
  active: true,
  // Whatever is switched on — asked when the palette routes a hit, so it follows the switch.
  owns: feature => !!studio.getState().features[feature.id]?.enabled,
  footer: InspectorFooter,
  component: Inspector,
}
