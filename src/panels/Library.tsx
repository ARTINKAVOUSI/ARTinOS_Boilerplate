import { Fragment, memo, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { panels, type PanelManifest } from '../app/panel'
import type { DiscoveredFeature } from '../app/feature'
import { features, findFeature } from '../app/registry'
import { studio, useFeatureState, useStudio, type StudioState } from '../app/store'
import { catalogue, captionOf, Glyphs, matches, sectionOf } from '../app/studio/catalogue'
import { ControlInput, labelOf, namesItself } from '../app/studio/ControlField'
import { Icons } from '../app/studio/icons'
import { PanelBar } from '../app/studio/PanelBar'
import { Button } from '../ui/Button/Button'
import { FileDrop } from '../ui/FileDrop/FileDrop'
import { IconButton } from '../ui/IconButton/IconButton'
import { Menu, type MenuEntry } from '../ui/Menu/Menu'
import { PropertyRow } from '../ui/PropertyRow/PropertyRow'
import { Segmented } from '../ui/Segmented/Segmented'
import { TextField } from '../ui/TextField/TextField'
import { useToast } from '../ui/Toast/Toast'

/*
 * The Library: everything the studio can put on the canvas, sorted the way the
 * catalogue sorts it, plus the session's imported files and the source kit.
 * Adding a component switches it on; its parameters then live in the
 * Inspector, which lists only what is active.
 */

const selectSwitches = (state: StudioState) => features.map(feature => (state.features[feature.id]?.enabled ? '1' : '0')).join('')
const selectReveal = (state: StudioState) => state.reveal
const selectAdvanced = (state: StudioState) => state.ui.advanced

const copyPath = (toast: ReturnType<typeof useToast>, path: string) =>
  navigator.clipboard?.writeText(path).then(
    () => toast({ title: 'Path copied', description: path }),
    () => toast({ tone: 'error', title: 'Could not copy', description: path }),
  )

// ── components ─────────────────────────────────────────────────────────────

/** One component: what it is, and Add — or Inspect and Remove once it is on the canvas. */
const LibraryItem = memo(function LibraryItem({ feature }: { feature: DiscoveredFeature }) {
  const state = useFeatureState(feature.id)
  const reveal = useStudio(selectReveal)
  const advanced = useStudio(selectAdvanced)
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const item = useRef<HTMLElement>(null)
  const mine = reveal?.featureId === feature.id ? reveal : null

  // Reached from the command palette: unfold, settings showing, and come into view.
  useEffect(() => {
    if (!mine) return
    setOpen(true)
    item.current?.scrollIntoView({ block: 'nearest' })
  }, [mine?.at])

  if (!state) return null
  const added = state.enabled
  // The pipeline host is always mounted; off means bypassed, not gone.
  const host = feature.kind === 'canvas-provider'
  const controls = Object.entries(feature.controls ?? {}).filter(([name, control]) => !control.advanced || advanced || mine?.control === name)

  return (
    <article ref={item} className="v2-lib-item" data-added={added || undefined} data-open={open || undefined} data-revealed={mine ? '' : undefined}>
      <span className="v2-lib-item__glyph">{Glyphs[sectionOf(feature)]}</span>
      <button type="button" className="v2-lib-item__name" aria-expanded={open} title={open ? 'Hide details' : 'Details and settings'} onClick={() => setOpen(value => !value)}>
        <span>{feature.label}</span>
      </button>
      <span className="v2-lib-item__actions">
        {added ? (
          <>
            <IconButton size="sm" label={`Show ${feature.label} in the Inspector`} icon={Icons.sliders} onClick={() => studio.reveal(feature.id)} />
            <IconButton size="sm" label={host ? `Bypass ${feature.label}` : `Remove ${feature.label}`} icon={Icons.close} onClick={() => studio.setEnabled(feature.id, false)} />
          </>
        ) : (
          <Button size="sm" icon={Icons.plus} onClick={() => studio.setEnabled(feature.id, true)}>
            {host ? 'Turn on' : 'Add'}
          </Button>
        )}
      </span>
      <p className="v2-lib-item__desc">{feature.description}</p>
      <small className="v2-lib-item__meta">
        {added && (
          <em className="v2-state" data-tone="live">
            {host ? 'On' : 'Added'}
          </em>
        )}
        <span>{captionOf(feature)}</span>
      </small>
      {open && (
        <div className="v2-lib-item__details">
          <div className="v2-lib-item__source">
            <span className="v2-path" title={feature.path}>
              {feature.path}
            </span>
            <IconButton size="sm" label={`Copy the path of ${feature.label}`} icon={Icons.copy} onClick={() => copyPath(toast, feature.path)} />
            <IconButton size="sm" label={`Reset ${feature.label} to its defaults`} icon={Icons.reset} onClick={() => studio.reset(feature.id)} />
          </div>
          {controls.length > 0 && <div className="v2-control-group">{added ? 'Settings' : 'Settings · applied when added'}</div>}
          {controls.map(([name, control]) => (
            <PropertyRow key={name} label={labelOf(name, control)} density={namesItself(control) ? 'default' : 'compact'} dataControl={name} highlighted={mine?.control === name}>
              <ControlInput name={name} control={control} value={state.values[name]} onChange={value => studio.setValue(feature.id, name, value)} />
            </PropertyRow>
          ))}
        </div>
      )}
    </article>
  )
})

// ── assets: files imported this session ────────────────────────────────────

interface Asset {
  id: string
  name: string
  size: number
  type: 'image' | 'model' | 'lut' | 'other'
  url: string
}

// Session-only: object URLs die with the page, so the list does too (and the
// studio drops `blob:` values when it restores a saved session).
let assets: Asset[] = []
const assetListeners = new Set<() => void>()
const emitAssets = () => assetListeners.forEach(listener => listener())
const subscribeAssets = (listener: () => void) => {
  assetListeners.add(listener)
  return () => assetListeners.delete(listener)
}
const getAssets = () => assets

const kindOf = (file: File): Asset['type'] => {
  const name = file.name.toLowerCase()
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|avif)$/.test(name)) return 'image'
  if (/\.(glb|gltf)$/.test(name)) return 'model'
  if (name.endsWith('.cube')) return 'lut'
  return 'other'
}
const bytes = (size: number) => (size > 1e6 ? `${(size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1e3))} kB`)

/** Where an asset can be applied: feature id, control key. Applying switches the feature on. */
const USES: Record<Asset['type'], Array<{ label: string; feature: string; key: string }>> = {
  image: [
    { label: 'Use as environment', feature: 'scene.environment', key: 'image' },
    { label: 'Use as transition target', feature: 'effect.transition', key: 'image' },
  ],
  model: [{ label: 'Load as model', feature: 'object.model', key: 'url' }],
  lut: [{ label: 'Use as color grade', feature: 'effect.lut3d', key: 'url' }],
  other: [],
}

function AssetItem({ asset }: { asset: Asset }) {
  const toast = useToast()
  const uses = USES[asset.type].filter(use => findFeature(use.feature))
  const items: MenuEntry[] = [
    ...uses.map(use => ({
      id: use.label,
      label: use.label,
      onSelect: () => {
        studio.setValue(use.feature, use.key, asset.url)
        if (use.feature === 'scene.environment') studio.setValue(use.feature, 'preset', 'image')
        studio.setEnabled(use.feature, true)
        toast({ tone: 'success', title: use.label, description: asset.name })
      },
    })),
    ...(uses.length ? ([{ type: 'separator' }] as MenuEntry[]) : []),
    {
      id: 'remove',
      label: 'Remove',
      danger: true,
      onSelect: () => {
        // A feature still showing the file keeps its URL alive; it dies with the page.
        const inUse = Object.values(studio.getState().features).some(state => Object.values(state.values).includes(asset.url))
        if (!inUse) URL.revokeObjectURL(asset.url)
        assets = assets.filter(entry => entry.id !== asset.id)
        emitAssets()
      },
    },
  ]
  return (
    <article className="v2-lib-item">
      <span className="v2-lib-item__glyph" data-thumb={asset.type === 'image' || undefined}>
        {asset.type === 'image' ? <img src={asset.url} alt="" /> : Glyphs.assets}
      </span>
      <span className="v2-lib-item__name" title={asset.name}>
        <span>{asset.name}</span>
      </span>
      <span className="v2-lib-item__actions">
        <Menu align="end" items={items} trigger={<Button size="sm">Use…</Button>} />
      </span>
      <small className="v2-lib-item__meta">
        <span>
          {asset.type} · {bytes(asset.size)}
        </span>
      </small>
    </article>
  )
}

function Assets({ query }: { query: string }) {
  const list = useSyncExternalStore(subscribeAssets, getAssets, getAssets)
  const shown = list.filter(asset => asset.name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <>
      <FileDrop
        accept="image/*,.glb,.gltf,.cube"
        title="Drop images, glTF models or .cube LUTs"
        hint="Or click to browse · files stay in this browser session"
        onFiles={files => {
          assets = [...assets, ...files.map(file => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, size: file.size, type: kindOf(file), url: URL.createObjectURL(file) }))]
          emitAssets()
        }}
      />
      {list.length === 0 ? (
        <p className="v2-note">An imported file can become the environment, a model in the scene, a transition target or a color grade.</p>
      ) : shown.length === 0 ? (
        <div className="v2-empty">No asset is named like “{query.trim()}”.</div>
      ) : (
        <div className="v2-lib-grid">
          {shown.map(asset => (
            <AssetItem key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </>
  )
}

// ── source kit: the reusable files behind the studio ───────────────────────

interface SourceEntry {
  id: string
  label: string
  path: string
  description: string
}

// File names only — nothing here is loaded. One entry per component folder:
// the file named after its folder (src/ui/Slider/Slider.tsx), plus MetaBlock's entry.
const uiKit: SourceEntry[] = Object.keys(import.meta.glob(['../ui/*/*.tsx', '../ui/MetaBlock/index.ts', '!../ui/system/*']))
  .map(path => ({ folder: path.split('/')[2], file: path.split('/').at(-1)!.replace(/\.tsx?$/, ''), path }))
  .filter(({ folder, file }) => folder === file || folder === 'MetaBlock')
  .map(({ folder, path }) => ({ id: `ui.${folder}`, label: folder, path: path.replace('../', 'src/'), description: `Copy the src/ui/${folder}/ folder; src/ui/system/ comes once with the first one.` }))

function SourceItem({ entry }: { entry: SourceEntry }) {
  const toast = useToast()
  return (
    <article className="v2-lib-item">
      <span className="v2-lib-item__glyph">{Glyphs.source}</span>
      <span className="v2-lib-item__name" title={entry.path}>
        <span>{entry.label}</span>
      </span>
      <span className="v2-lib-item__actions">
        <IconButton size="sm" label={`Copy the path of ${entry.label}`} icon={Icons.copy} onClick={() => copyPath(toast, entry.path)} />
      </span>
      <p className="v2-lib-item__desc">{entry.description}</p>
      <small className="v2-lib-item__meta">
        <span className="v2-path">{entry.path}</span>
      </small>
    </article>
  )
}

function SourceKit({ query }: { query: string }) {
  // Read on render: the panel registry is still loading while this module evaluates.
  const studioPanels: SourceEntry[] = panels.map(panel => ({ id: `panel.${panel.id}`, label: panel.title, path: panel.path, description: panel.description ?? '' }))
  const needle = query.trim().toLowerCase()
  const shelves = [
    { id: 'panels', label: 'Studio panels', list: studioPanels },
    { id: 'ui', label: 'UI kit', list: uiKit },
  ].map(shelf => ({ ...shelf, list: shelf.list.filter(entry => `${entry.label} ${entry.path}`.toLowerCase().includes(needle)) }))
  if (shelves.every(shelf => shelf.list.length === 0)) return <div className="v2-empty">Nothing in the source kit is named like “{query.trim()}”.</div>
  return (
    <>
      <p className="v2-note">Every unit is one file or one folder: copy it into another project and it works there. Features carry their own path in their details.</p>
      {shelves.map(
        shelf =>
          shelf.list.length > 0 && (
            <Fragment key={shelf.id}>
              <h4 className="v2-lib-shelf">
                {shelf.label} <small>{shelf.list.length}</small>
              </h4>
              <div className="v2-lib-grid">
                {shelf.list.map(entry => (
                  <SourceItem key={entry.id} entry={entry} />
                ))}
              </div>
            </Fragment>
          ),
      )}
    </>
  )
}

// ── the rail and the panel ─────────────────────────────────────────────────

function NavItem({ icon, label, added, total, current, depth = 0, onSelect }: { icon?: ReactNode; label: string; added?: number; total: number; current: boolean; depth?: 0 | 1; onSelect: () => void }) {
  return (
    <button type="button" className="v2-lib-nav__item" data-depth={depth || undefined} aria-current={current || undefined} onClick={onSelect}>
      {depth === 0 && <span className="v2-lib-nav__icon">{icon}</span>}
      <span className="v2-lib-nav__label">{label}</span>
      <span className="v2-lib-nav__count">
        {added !== undefined && added > 0 && <b>{added}</b>}
        {added !== undefined && added > 0 ? ` / ${total}` : total}
      </span>
    </button>
  )
}

type Show = 'all' | 'added' | 'available'

function Library() {
  useStudio(selectSwitches)
  const states = studio.getState().features
  const assetCount = useSyncExternalStore(subscribeAssets, () => assets.length, () => assets.length)
  const reveal = useStudio(selectReveal)
  // 'all', a section id, a shelf id (`section/shelf`), 'assets' or 'source'.
  const [place, setPlace] = useState('all')
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<Show>('all')

  const on = (feature: DiscoveredFeature) => !!states[feature.id]?.enabled
  const addedIn = (list: DiscoveredFeature[]) => list.filter(on).length
  const sectionId = place.split('/')[0]
  const browsing = place !== 'assets' && place !== 'source'

  // A palette jump to a component that is not on the canvas lands here: show it.
  useEffect(() => {
    const feature = reveal && findFeature(reveal.featureId)
    if (!feature || studio.getState().features[feature.id]?.enabled) return
    setPlace(sectionOf(feature))
    setQuery('')
    setShow('all')
  }, [reveal?.at])

  // A few dozen entries: filtered on every render, which happens only when a switch flips or a filter changes.
  const sections = catalogue
    .filter(section => place === 'all' || section.id === sectionId)
    .map(section => ({
      ...section,
      shelves: section.shelves
        .filter(shelf => !place.includes('/') || shelf.id === place)
        .map(shelf => ({ ...shelf, features: shelf.features.filter(feature => matches(feature, query) && (show === 'all' || (show === 'added') === on(feature))) }))
        .filter(shelf => shelf.features.length),
    }))
    .filter(section => section.shelves.length)

  const totalAdded = addedIn(features)

  return (
    <div className="artinos-panel-suite">
      <PanelBar>
        <TextField type="search" label="Filter the library" placeholder={place === 'assets' ? 'Filter assets' : place === 'source' ? 'Filter the source kit' : 'Filter components'} value={query} onChange={setQuery} />
        {browsing && (
          <Segmented
            label="Show"
            value={show}
            onChange={setShow}
            options={[
              { value: 'all', label: 'All' },
              { value: 'added', label: `Added · ${totalAdded}` },
              { value: 'available', label: 'Available' },
            ]}
            // Segments share the width equally, so give each room for the longest label.
            style={{ minWidth: 'min(300px, 100%)' }}
          />
        )}
        <span className="v2-spacer" />
        <span className="v2-bar-summary">
          {features.length} components · {totalAdded} on the canvas
        </span>
      </PanelBar>

      <div className="v2-lib">
        <nav className="v2-lib-nav" aria-label="Library categories">
          <NavItem icon={Glyphs.all} label="All components" added={totalAdded} total={features.length} current={place === 'all'} onSelect={() => setPlace('all')} />
          {catalogue.map(section => (
            <Fragment key={section.id}>
              <NavItem icon={section.icon} label={section.label} added={addedIn(section.features)} total={section.features.length} current={place === section.id} onSelect={() => setPlace(section.id)} />
              {sectionId === section.id &&
                section.shelves.length > 1 &&
                section.shelves.map(shelf => (
                  <NavItem key={shelf.id} depth={1} label={shelf.label} added={addedIn(shelf.features)} total={shelf.features.length} current={place === shelf.id} onSelect={() => setPlace(place === shelf.id ? section.id : shelf.id)} />
                ))}
            </Fragment>
          ))}
          <span className="v2-lib-nav__rule" />
          <NavItem icon={Glyphs.assets} label="Assets" total={assetCount} current={place === 'assets'} onSelect={() => setPlace('assets')} />
          <NavItem icon={Glyphs.source} label="Source kit" total={panels.length + uiKit.length} current={place === 'source'} onSelect={() => setPlace('source')} />
        </nav>

        <div className="v2-lib-body">
          {place === 'assets' ? (
            <Assets query={query} />
          ) : place === 'source' ? (
            <SourceKit query={query} />
          ) : sections.length === 0 ? (
            <div className="v2-empty">
              <b>{show === 'added' && !query.trim() ? 'Nothing added here yet' : 'No component matches'}</b>
              {query.trim() ? `Nothing here is named or described like “${query.trim()}”.` : 'Switch the filter to All to see what can be added.'}
              <Button
                size="sm"
                onClick={() => {
                  setQuery('')
                  setShow('all')
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            sections.map(section => (
              <section key={section.id} className="v2-lib-group">
                <h3 className="v2-section">
                  {section.label} <small>{section.note}</small>
                </h3>
                {section.shelves.map(shelf => (
                  <Fragment key={shelf.id}>
                    {(section.shelves.length > 1 || shelf.label !== section.label) && (
                      <h4 className="v2-lib-shelf">
                        {shelf.label} <small>{shelf.features.length}</small>
                      </h4>
                    )}
                    <div className="v2-lib-grid">
                      {shelf.features.map(feature => (
                        <LibraryItem key={feature.id} feature={feature} />
                      ))}
                    </div>
                  </Fragment>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Library

export const panel: PanelManifest = {
  id: 'library',
  title: 'Library',
  description: 'Every component, by category: add it to the canvas. Also imported assets and the source kit.',
  keywords: ['components', 'add', 'catalog', 'effects', 'objects', 'scene', 'assets', 'import', 'files', 'copy', 'paths', 'postfx'],
  order: 1,
  // Whatever is not on the canvas: the Inspector, earlier in tab order, claims the rest.
  owns: () => true,
  footer: () => <>COMPONENTS · ASSETS · SOURCE KIT</>,
  component: Library,
}
