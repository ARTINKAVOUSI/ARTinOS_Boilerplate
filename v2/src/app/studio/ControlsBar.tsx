import { useRef, useState } from 'react'
import { studio, useStudio, type StudioState } from '../store'
import { TextField } from '../../ui/TextField/TextField'
import { Select } from '../../ui/Select/Select'
import { Menu, type MenuEntry } from '../../ui/Menu/Menu'
import { Button } from '../../ui/Button/Button'
import { Dialog } from '../../ui/Dialog/Dialog'
import { useToast } from '../../ui/Toast/Toast'
import type { ControlFilter } from './FeatureCard'
import { Icons } from './icons'

const selectPresets = (state: StudioState) => state.presets

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Save, load, export and import whole-studio looks. */
export function PresetMenu() {
  const toast = useToast()
  const presets = useStudio(selectPresets)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('My look')
  const file = useRef<HTMLInputElement>(null)
  const names = Object.keys(presets)

  const items: MenuEntry[] = [
    { id: 'save', label: 'Save current look…', icon: Icons.plus, onSelect: () => setSaving(true) },
    { id: 'export', label: 'Export settings (JSON)', icon: Icons.download, onSelect: () => download('artinos-settings.json', studio.exportJSON()) },
    { id: 'import', label: 'Import settings…', icon: Icons.upload, onSelect: () => file.current?.click() },
    ...(names.length ? ([{ type: 'separator' }, { type: 'label', label: 'Looks' }] as MenuEntry[]) : []),
    ...names.map<MenuEntry>(preset => ({ id: `load-${preset}`, label: preset, icon: Icons.bookmark, onSelect: () => studio.loadPreset(preset) })),
    { type: 'separator' },
    ...names.map<MenuEntry>(preset => ({ id: `delete-${preset}`, label: `Delete “${preset}”`, danger: true, icon: Icons.trash, onSelect: () => studio.deletePreset(preset) })),
    { id: 'reset', label: 'Reset every feature', danger: true, icon: Icons.reset, onSelect: () => studio.resetAll() },
  ]

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    studio.savePreset(trimmed)
    setSaving(false)
    toast({ tone: 'success', title: `Saved “${trimmed}”` })
  }

  return (
    <>
      <Menu align="end" items={items} trigger={<Button size="sm" icon={Icons.bookmark}>Presets</Button>} />
      <Dialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save look"
        description="Stores every feature's switch and settings in this browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!name.trim()} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <TextField value={name} onChange={setName} label="Look name" autoFocus onKeyDown={event => event.key === 'Enter' && save()} />
      </Dialog>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async event => {
          const picked = event.target.files?.[0]
          event.target.value = ''
          if (!picked) return
          try {
            studio.importJSON(await picked.text())
            toast({ tone: 'success', title: 'Settings imported', description: picked.name })
          } catch (error) {
            toast({ tone: 'error', title: 'Import failed', description: error instanceof Error ? error.message : String(error) })
          }
        }}
      />
    </>
  )
}

/** The panel toolbar shared by control panels: search, filter, presets. */
export function ControlsBar({ query, onQuery, filter, onFilter, placeholder }: { query: string; onQuery: (value: string) => void; filter: ControlFilter; onFilter: (value: ControlFilter) => void; placeholder: string }) {
  return (
    <div className="v2-panel-bar">
      <TextField type="search" size="sm" value={query} onChange={onQuery} label={placeholder} placeholder={placeholder} />
      <Select<ControlFilter>
        size="sm"
        label="Show"
        value={filter}
        onChange={onFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'favorites', label: 'Favorites' },
          { value: 'pinned', label: 'Pinned' },
        ]}
      />
      <span className="v2-spacer" />
      <PresetMenu />
    </div>
  )
}

