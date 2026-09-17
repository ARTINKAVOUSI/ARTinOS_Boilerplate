import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { features } from '../registry'
import { onFeatureError } from '../FeatureBoundary'
import { studio, useStudio, type StudioState } from '../store'
import { Toolbar, ToolbarSeparator } from '../../ui/Toolbar/Toolbar'
import { IconButton } from '../../ui/IconButton/IconButton'
import { Menu, type MenuEntry } from '../../ui/Menu/Menu'
import { CommandPalette, type Command } from '../../ui/CommandPalette/CommandPalette'
import { Dialog } from '../../ui/Dialog/Dialog'
import { Button } from '../../ui/Button/Button'
import { TextField } from '../../ui/TextField/TextField'
import { Kbd } from '../../ui/Kbd/Kbd'
import { useToast } from '../../ui/Toast/Toast'
import { ScenePanel } from './ScenePanel'
import { PostFXPanel } from './PostFXPanel'
import { Icons } from './icons'
import './studio.css'

const WORLDS = ['frost', 'clear', 'satin', 'graphite', 'opal', 'monolith'] as const
const selectPresets = (state: StudioState) => state.presets
const selectUI = (state: StudioState) => state.ui
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The editor chrome over the canvas: toolbar, panels, command palette, presets. */
export function Studio() {
  const toast = useToast()
  const ui = useStudio(selectUI)
  const presets = useStudio(selectPresets)
  const isNarrow = () => window.innerWidth < 760
  const [showScene, setShowScene] = useState(true)
  const [showFX, setShowFX] = useState(() => !isNarrow())
  const [palette, setPalette] = useState(false)
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const importInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.dataset.world = ui.world
  }, [ui.world])

  useEffect(
    () =>
      onFeatureError((id, error) =>
        toast({ tone: 'error', title: `${id} stopped`, description: error.message, duration: 6000 }),
      ),
    [toast],
  )

  const toggleUI = useCallback(() => studio.setUI({ visible: !studio.getState().ui.visible }), [])

  // On narrow screens only one panel fits.
  const openScene = (value: boolean) => {
    setShowScene(value)
    if (value && isNarrow()) setShowFX(false)
  }
  const openFX = (value: boolean) => {
    setShowFX(value)
    if (value && isNarrow()) setShowScene(false)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'h' || event.key === 'H') toggleUI()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleUI])

  const importFile = async (file: File) => {
    try {
      studio.importJSON(await file.text())
      toast({ tone: 'success', title: 'Settings imported', description: file.name })
    } catch (error) {
      toast({ tone: 'error', title: 'Import failed', description: error instanceof Error ? error.message : String(error) })
    }
  }

  const presetItems: MenuEntry[] = [
    { id: 'save', label: 'Save current as preset…', icon: Icons.plus, onSelect: () => setSaving(true) },
    { id: 'export', label: 'Export settings (JSON)', icon: Icons.download, onSelect: () => download('artinos-settings.json', studio.exportJSON()) },
    { id: 'import', label: 'Import settings…', icon: Icons.upload, onSelect: () => importInput.current?.click() },
    ...(Object.keys(presets).length ? ([{ type: 'separator' }, { type: 'label', label: 'Presets' }] as MenuEntry[]) : []),
    ...Object.keys(presets).map<MenuEntry>(name => ({ id: `load-${name}`, label: name, icon: Icons.bookmark, onSelect: () => studio.loadPreset(name) })),
    { type: 'separator' },
    ...Object.keys(presets).map<MenuEntry>(name => ({ id: `delete-${name}`, label: `Delete “${name}”`, danger: true, icon: Icons.trash, onSelect: () => studio.deletePreset(name) })),
    { id: 'reset', label: 'Reset everything', danger: true, icon: Icons.reset, onSelect: () => studio.resetAll() },
  ]

  const worldItems: MenuEntry[] = WORLDS.map(world => ({
    id: world,
    label: world[0].toUpperCase() + world.slice(1),
    checked: ui.world === world,
    onSelect: () => studio.setUI({ world }),
  }))

  const commands = useMemo<Command[]>(
    () => [
      { id: 'ui.toggle', label: 'Hide / show interface', group: 'View', shortcut: 'H', icon: Icons.eye, run: toggleUI },
      { id: 'ui.scene', label: 'Toggle scene panel', group: 'View', icon: Icons.sliders, run: () => setShowScene(v => !v) },
      { id: 'ui.fx', label: 'Toggle post FX panel', group: 'View', icon: Icons.sparkles, run: () => setShowFX(v => !v) },
      ...WORLDS.map(world => ({ id: `world.${world}`, label: `Theme: ${world}`, group: 'View', icon: Icons.palette, run: () => studio.setUI({ world }) })),
      { id: 'preset.save', label: 'Save preset…', group: 'Presets', icon: Icons.bookmark, run: () => setSaving(true) },
      { id: 'preset.export', label: 'Export settings', group: 'Presets', icon: Icons.download, run: () => download('artinos-settings.json', studio.exportJSON()) },
      { id: 'preset.import', label: 'Import settings…', group: 'Presets', icon: Icons.upload, run: () => importInput.current?.click() },
      ...Object.keys(presets).map(name => ({ id: `preset.load.${name}`, label: `Load preset: ${name}`, group: 'Presets', icon: Icons.bookmark, run: () => studio.loadPreset(name) })),
      { id: 'reset.all', label: 'Reset every feature', group: 'Presets', icon: Icons.reset, run: () => studio.resetAll() },
      ...features.map(feature => ({
        id: `toggle.${feature.id}`,
        label: `Toggle ${feature.label}`,
        group: feature.kind === 'effect' ? 'Effects' : feature.group ?? 'Features',
        keywords: `${feature.id} ${feature.category ?? ''}`,
        icon: Icons.power,
        run: () => studio.setEnabled(feature.id, !studio.getState().features[feature.id]?.enabled),
      })),
      ...features.map(feature => ({
        id: `copy.${feature.id}`,
        label: `Copy path: ${feature.label}`,
        group: 'Files',
        keywords: feature.path,
        icon: Icons.copy,
        run: () => {
          void navigator.clipboard?.writeText(feature.path)
          toast({ title: 'Path copied', description: feature.path })
        },
      })),
    ],
    [presets, toggleUI, toast],
  )

  const savePreset = () => {
    const name = presetName.trim()
    if (!name) return
    studio.savePreset(name)
    setSaving(false)
    setPresetName('')
    toast({ tone: 'success', title: `Preset “${name}” saved` })
  }

  return (
    <div className="studio" data-hidden={!ui.visible || undefined}>
      <header className="studio-bar">
        <div className="studio-brand">
          <span className="studio-brand__mark" aria-hidden />
          ARTINOS<span>v2</span>
        </div>
        <Toolbar label="Studio" floating>
          <IconButton label="Scene panel" icon={Icons.sliders} active={showScene} onClick={() => openScene(!showScene)} />
          <IconButton label="Post FX panel" icon={Icons.sparkles} active={showFX} onClick={() => openFX(!showFX)} />
          <ToolbarSeparator />
          <Menu items={presetItems} trigger={<IconButton label="Presets" icon={Icons.bookmark} />} />
          <Menu items={worldItems} trigger={<IconButton label="Theme" icon={Icons.palette} />} />
          <IconButton label="Command palette (Ctrl/⌘ K)" icon={Icons.command} onClick={() => setPalette(true)} />
          <ToolbarSeparator />
          <IconButton label="Hide interface (H)" icon={Icons.eye} onClick={toggleUI} />
        </Toolbar>
      </header>

      <div className="studio-hint" aria-hidden={ui.visible}>
        Press <Kbd keys={['H']} /> to show the interface
      </div>

      <div className="studio-panels">
        <aside className="studio-slot" data-side="left">
          {showScene && <ScenePanel onClose={() => setShowScene(false)} />}
        </aside>
        <aside className="studio-slot" data-side="right">
          {showFX && <PostFXPanel onClose={() => setShowFX(false)} />}
        </aside>
      </div>

      <CommandPalette commands={commands} open={palette} onOpenChange={setPalette} />

      <Dialog
        open={saving}
        onClose={() => setSaving(false)}
        title="Save preset"
        description="Stores every feature's on/off state and settings in this browser."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!presetName.trim()} onClick={savePreset}>
              Save
            </Button>
          </>
        }
      >
        <TextField
          value={presetName}
          onChange={setPresetName}
          label="Preset name"
          placeholder="e.g. Night glass"
          autoFocus
          onKeyDown={event => event.key === 'Enter' && savePreset()}
        />
      </Dialog>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
