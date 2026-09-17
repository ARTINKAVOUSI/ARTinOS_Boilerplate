import { useState, type CSSProperties, type ReactNode } from 'react'
import { usePersistentState, usePersistentValue } from '../headless'
import { Button, Pane, SelectionList, controls } from '../primitives'
import { AppBar } from '../shell/AppBar'
import { SceneBackdrop } from '../shell/SceneBackdrop'
import { Composition } from './studio/Composition'
import { Controls } from './studio/Controls'
import { Core } from './studio/Core'
import { Foundations } from './studio/Foundations'
import { Instruments } from './studio/Instruments'
import { SCENES, ThemeEditor, WORLDS, type SceneId, type ThemeState, type WorldId } from './studio/ThemeEditor'
import './ui-studio.css'

/**
 * UI Studio — the design system in one place.
 *
 * The core reference rebuilt from the kit, foundations, every component live, the
 * composed patterns, and an editor over the material world and every token under
 * it — all floating on a living scene, with the world bar the reference uses.
 * It is built entirely from the package's own components, so the page is its own
 * proof: if a control regresses, the studio shows it.
 */

interface Section {
  id: string
  label: string
  meta: string
  layout?: 'single'
  render(): ReactNode
}

const SECTIONS: Section[] = [
  { id: 'core', label: 'Core', meta: 'REFERENCE', layout: 'single', render: () => <Core /> },
  { id: 'foundations', label: 'Foundations', meta: 'TOKENS', render: () => <Foundations /> },
  { id: 'controls', label: 'Controls', meta: 'INPUTS', render: () => <Controls /> },
  { id: 'instruments', label: 'Instruments', meta: 'SIGNAL', render: () => <Instruments /> },
  { id: 'composition', label: 'Composition', meta: 'PATTERNS', render: () => <Composition /> },
]

const DEFAULT_THEME: ThemeState = { world: 'frost', scene: 'atelier', density: 'default', overrides: {} }

export function UIStudio() {
  // A stored section id only wins if it still names a section that exists.
  const [active, setActive] = usePersistentValue<string>('artinos.ui-studio.section', SECTIONS[0].id, raw =>
    SECTIONS.some(entry => entry.id === raw) ? raw : null,
  )
  // v2: the state became a world and a scene when the kit moved to the core
  // reference, so a v1 theme would not describe anything this page can show.
  const [theme, , setTheme] = usePersistentState<ThemeState>('artinos.ui-studio.theme.v2', DEFAULT_THEME)
  // The editor reads its starting values from the themed element itself, so it needs
  // the node rather than a ref that is still null on the first render.
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  // A drawer rather than a column: always reachable from the bar, docked beside the
  // work when there is room and floating over it when there is not.
  const [editorOpen, setEditorOpen] = usePersistentValue<string>('artinos.ui-studio.editor', 'open', raw =>
    raw === 'open' || raw === 'closed' ? raw : null,
  )
  const open = editorOpen === 'open'

  const section = SECTIONS.find(entry => entry.id === active) ?? SECTIONS[0]
  const componentCount = controls.list().length
  const world = WORLDS.find(entry => entry.id === theme.world) ?? WORLDS[1]
  const scene: SceneId = SCENES.some(entry => entry.id === theme.scene) ? theme.scene : 'atelier'
  const setWorld = (id: WorldId) => setTheme(previous => ({ ...previous, world: id }))
  const setScene = (id: SceneId) => setTheme(previous => ({ ...previous, scene: id }))

  return (
    <div
      ref={setRoot}
      className="ui-studio artinos-root"
      data-editor={open ? 'open' : 'closed'}
      data-world={world.id}
      data-context={theme.density === 'default' ? undefined : theme.density}
      style={theme.overrides as CSSProperties}
    >
      <SceneBackdrop environment={scene} className="ui-studio-scene" />

      <AppBar
        brand="ARTINOS"
        title="Core UI / MetaComp"
        context={`${world.name} · ${componentCount} components`}
        nav={
          <>
            <Button className="ui-studio-editor-toggle" aria-expanded={open} onClick={() => setEditorOpen(open ? 'closed' : 'open')}>
              {open ? 'Hide editor' : 'Theme editor'}
            </Button>
            <a href="?">Studio app</a>
          </>
        }
      />

      <div className="ui-studio-body">
        <Pane
          className="ui-studio-nav"
          title="Sections"
          meta="Core UI / design system"
          footer={
            <>
              <span>{SECTIONS.length} sections</span>
              <span>@artinos/ui</span>
            </>
          }
        >
          <SelectionList
            label="Studio sections"
            items={SECTIONS.map(entry => ({ id: entry.id, label: entry.label, meta: entry.meta }))}
            value={section.id}
            onChange={setActive}
          />
        </Pane>

        <main className="ui-studio-main" data-layout={section.layout} aria-label={section.label}>
          {section.render()}
        </main>

        <ThemeEditor state={{ ...theme, world: world.id, scene }} scope={root} onChange={setTheme} />
      </div>

      <nav className="ui-studio-bar" aria-label="Material world and scene">
        {WORLDS.map(entry => (
          <button key={entry.id} type="button" aria-pressed={entry.id === world.id} onClick={() => setWorld(entry.id)}>
            {entry.label}
          </button>
        ))}
        <span className="ui-studio-bar-rule" aria-hidden />
        <span className="ui-studio-bar-label">Scene</span>
        {SCENES.map(entry => (
          <button key={entry.id} type="button" aria-pressed={entry.id === scene} onClick={() => setScene(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
