import { useMemo, useState } from 'react'
import { panels, type PanelManifest } from '../app/panel'
import { features } from '../app/registry'
import { studio, useStudio, type StudioState } from '../app/store'
import { Select } from '../ui/Select/Select'
import { Switch } from '../ui/Switch/Switch'
import { IconButton } from '../ui/IconButton/IconButton'
import { useToast } from '../ui/Toast/Toast'
import { Icons } from '../app/studio/icons'
import { PanelBar } from '../app/studio/PanelBar'

// File names only — nothing here is loaded. One entry per component folder:
// the file named after its folder (src/ui/Slider/Slider.tsx), plus MetaBlock's entry.
const uiComponents = Object.keys(import.meta.glob(['../ui/*/*.tsx', '../ui/MetaBlock/index.ts', '!../ui/system/*']))
  .map(path => {
    const folder = path.split('/')[2]
    const file = path.split('/').at(-1)!.replace(/\.tsx?$/, '')
    return { folder, file, path }
  })
  .filter(({ folder, file }) => folder === file || folder === 'MetaBlock')
  .map(({ folder, path }) => ({
    id: `ui.${folder}`,
    label: folder,
    kind: 'ui component',
    path: path.replace('../', 'src/'),
    description: `Copy the src/ui/${folder}/ folder; src/ui/system/ comes once with the first one.`,
  }))

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
        <Select appearance="well" label="Kind" value={kind} onChange={setKind} options={KINDS.map(value => ({ value, label: value === 'all' ? 'Everything' : value }))} />
        <span className="artinos-panel-summary v2-bar-summary">
          {features.length} FEATURES · {panels.length} PANELS · {uiComponents.length} UI COMPONENTS · COPY A FILE OR FOLDER TO REUSE IT
        </span>
      </PanelBar>
      <div className="v2-entries">
        {visible.map(entry => (
          <div key={entry.id} className="v2-entry">
            <span className="v2-tile__name">
              <span>{entry.label}</span>
              <em className="v2-state">{entry.kind}</em>
            </span>
            <span className="v2-entry__actions">
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
                <Switch variant="compact" label={`${entry.label} enabled`} value={states[entry.featureId].enabled} onChange={value => studio.setEnabled(entry.featureId!, value)} />
              )}
            </span>
            {entry.description && <p>{entry.description}</p>}
            <span className="v2-path" title={entry.path}>
              {entry.path}
            </span>
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
