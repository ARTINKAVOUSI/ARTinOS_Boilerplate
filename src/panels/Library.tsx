import { useMemo, useState } from 'react'
import { panels, type PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { studio, useStudio, type StudioState } from '../app/store'
import { Select } from '../ui/Select/Select'
import { Toggle } from '../ui/Toggle/Toggle'
import { IconButton } from '../ui/IconButton/IconButton'
import { useToast } from '../ui/Toast/Toast'
import { Icons } from '../app/studio/icons'
import { PanelBar } from '../app/studio/PanelBar'

// File names only — nothing here is loaded.
const uiComponents = Object.keys(import.meta.glob('../ui/*/*.tsx')).map(path => {
  const name = path.split('/').at(-1)!.replace('.tsx', '')
  return { id: `ui.${name}`, label: name, kind: 'ui component', path: path.replace('../', 'src/'), description: `Copy the src/ui/${path.split('/')[2]}/ folder.` }
}).filter(entry => entry.label !== 'index' && !entry.path.includes('/MetaBlock/react'))

type Entry = { id: string; label: string; kind: string; path: string; description?: string; featureId?: string }

// Built on first use: the panel registry is still loading while this module evaluates.
const buildEntries = (): Entry[] => [
  ...features.map(feature => ({ id: feature.id, label: feature.label, kind: feature.kind === 'effect' ? `effect · ${feature.category}` : feature.kind, path: feature.path, description: feature.description, featureId: feature.id })),
  ...panels.map(panel => ({ id: `panel.${panel.id}`, label: panel.title, kind: 'panel', path: panel.path, description: panel.description })),
  ...uiComponents,
]
const KINDS = ['all', 'scene', 'effect', 'app', 'overlay', 'canvas-provider', 'panel', 'ui component'] as const
const selectFeatures = (state: StudioState) => state.features

function Library() {
  const toast = useToast()
  const states = useStudio(selectFeatures)
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all')
  const entries = useMemo(buildEntries, [])
  const visible = useMemo(() => entries.filter(entry => kind === 'all' || entry.kind.startsWith(kind)), [entries, kind])
  return (
    <div className="artinos-panel-suite">
      <PanelBar>
        <Select size="sm" label="Kind" value={kind} onChange={setKind} options={KINDS.map(value => ({ value, label: value === 'all' ? 'Everything' : value }))} />
        <span className="artinos-panel-summary v2-bar-summary">
          {features.length} FEATURES · {panels.length} PANELS · {uiComponents.length} UI COMPONENTS · COPY A FILE OR FOLDER TO REUSE IT
        </span>
      </PanelBar>
      <div className="artinos-parameter-cards">
        {visible.map(entry => (
          <div key={entry.id} className="artinos-module-card artinos-parameter-card">
            <div className="v2-panel-bar" style={{ margin: 0 }}>
              <span className="artinos-module-head">
                <b>{entry.label}</b> <small className="artinos-effect-cost">{entry.kind}</small>
              </span>
              <span className="v2-spacer" />
              <IconButton
                size="sm"
                label={`Copy path of ${entry.label}`}
                icon={Icons.copy}
                onClick={() => {
                  void navigator.clipboard?.writeText(entry.path)
                  toast({ title: 'Path copied', description: entry.path })
                }}
              />
              {entry.featureId && states[entry.featureId] && (
                <Toggle size="sm" label={`${entry.label} enabled`} checked={states[entry.featureId].enabled} onChange={value => studio.setEnabled(entry.featureId!, value)} />
              )}
            </div>
            <p>
              {entry.description ? `${entry.description} · ` : ''}
              <code>{entry.path}</code>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Library

export const panel: PanelManifest = {
  id: 'library',
  title: 'Library',
  description: 'Every feature, panel and UI component, with its source path',
  keywords: ['modules', 'catalog', 'components', 'copy', 'paths'],
  order: 7,
  footer: () => <>SRC · FEATURES · PANELS · UI</>,
  component: Library,
}
