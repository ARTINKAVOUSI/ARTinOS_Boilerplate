import { useEffect, useMemo, useState } from 'react'
import type { PanelManifest } from '../app/panel'
import { byKind, findFeature } from '../app/registry'
import { studio, useStudio, type StudioState } from '../app/store'
import { useRuntime } from '../app/runtime'
import { FeatureCard } from '../app/studio/FeatureCard'
import { CardFlow } from '../app/studio/CardFlow'
import { FeatureTile } from '../app/studio/FeatureTile'
import { Icons } from '../app/studio/icons'
import { PanelBar } from '../app/studio/PanelBar'
import { Select } from '../ui/Select/Select'
import { Segmented } from '../ui/Segmented/Segmented'
import { Switch } from '../ui/Switch/Switch'
import { IconButton } from '../ui/IconButton/IconButton'
import type { DiscoveredFeature } from '../app/feature'

const effects = byKind('effect')
const CATEGORIES = ['all', 'light', 'lens', 'color', 'blur', 'stylize', 'temporal', 'screen-space', 'anti-aliasing'] as const
const selectFeatures = (state: StudioState) => state.features
const selectReveal = (state: StudioState) => state.reveal
const words = (value: string) => value.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase())

/** What an effect costs and needs, in a few quiet words. */
const captionOf = (effect: DiscoveredFeature) => [effect.cost && `${effect.cost.replace('-', ' ')} cost`, effect.webgpuOnly && 'WebGPU only'].filter(Boolean).join(' · ') || words(effect.category ?? '')

function PostFX() {
  const states = useStudio(selectFeatures)
  const host = findFeature('postfx')
  const [view, setView] = useState<'stack' | 'browse'>('stack')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all')
  const reveal = useStudio(selectReveal)

  // A palette hit on an effect that is not in the chain belongs in Browse.
  useEffect(() => {
    if (!reveal?.featureId.startsWith('effect.')) return
    setCategory('all')
    setView(states[reveal.featureId]?.enabled ? 'stack' : 'browse')
    // The enabled state at reveal time decides the view; later toggles must not move it again.
  }, [reveal?.at])

  const active = useMemo(
    () =>
      effects
        .filter(effect => states[effect.id]?.enabled)
        .sort((a, b) => (states[a.id]?.order ?? a.order ?? 500) - (states[b.id]?.order ?? b.order ?? 500)),
    [states],
  )
  const shelves = CATEGORIES.filter(name => name !== 'all' && (category === 'all' || category === name))
    .map(name => ({ name, list: effects.filter(effect => effect.category === name) }))
    .filter(shelf => shelf.list.length)
  const bypassed = host ? !states[host.id]?.enabled : true

  return (
    <div className="artinos-panel-suite">
      <PanelBar className="artinos-postfx-commandbar">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'stack', label: `Stack · ${active.length}` },
            { value: 'browse', label: `Browse · ${effects.length}` },
          ]}
        />
        {view === 'browse' && (
          <Select appearance="well" label="Category" value={category} onChange={setCategory} options={CATEGORIES.map(value => ({ value, label: value === 'all' ? 'All categories' : words(value) }))} />
        )}
        <span className="v2-spacer" />
        {host && (
          <label className="v2-inline-toggle">
            Pipeline
            <Switch variant="compact" label="Post-processing enabled" value={!bypassed} onChange={value => studio.setEnabled(host.id, value)} />
          </label>
        )}
      </PanelBar>

      {bypassed && <div className="artinos-panel-notice">Post-processing is bypassed. Effects keep their settings.</div>}

      {view === 'stack' ? (
        active.length === 0 ? (
          <div className="v2-empty">
            <b>The stack is empty</b>
            Effects run in the order they are listed here. Switch to Browse and turn some on.
          </div>
        ) : (
          <CardFlow>
            {active.map((effect, index) => (
              <FeatureCard
                key={effect.id}
                feature={effect}
                ordinal={index + 1}
                extra={
                  <>
                    <IconButton size="sm" label={`Move ${effect.label} earlier`} icon={Icons.up} disabled={index === 0} onClick={() => studio.moveEffect(effect.id, -1)} />
                    <IconButton size="sm" label={`Move ${effect.label} later`} icon={Icons.down} disabled={index === active.length - 1} onClick={() => studio.moveEffect(effect.id, 1)} />
                  </>
                }
              />
            ))}
          </CardFlow>
        )
      ) : (
        <>
          {shelves.map(shelf => (
            <section key={shelf.name}>
              <h3 className="v2-section">
                {words(shelf.name)} <small>{shelf.list.length}</small>
              </h3>
              <div className="v2-tiles">
                {shelf.list.map(effect => (
                  <FeatureTile key={effect.id} feature={effect} caption={captionOf(effect)} />
                ))}
              </div>
            </section>
          ))}
          {shelves.length === 0 && <div className="v2-empty">No effect in this category.</div>}
        </>
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
  owns: feature => feature.kind === 'effect' || feature.id === 'postfx',
  footer: PostFXFooter,
  component: PostFX,
}
