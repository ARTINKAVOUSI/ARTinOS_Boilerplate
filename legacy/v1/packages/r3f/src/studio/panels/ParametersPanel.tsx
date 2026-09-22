import { GlassInspector } from './GlassInspector'
import { memo, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime, type ParameterDefinition } from '@artinos/runtime'
import { Button, IconButton, PropertyRow, SearchField, Select, Toggle, Toolbar, TextField } from '@artinos/ui'
import { ParameterControl } from '../primitives/ParameterControl'
import { ChevronDown, Copy, Pin, Star, ClipboardPaste, Ellipsis } from 'lucide-react'
import { PanelEmpty } from '@artinos/ui'
import { usePersistentState } from '@artinos/ui'
import { useMultiParameter, useParameter, useParameterIds } from '../react/use-parameter'
import { useReveal } from '@artinos/ui'
import { materializeSchema, type ControlSchemaDefinition, type ParameterMaterializer, type ParameterTypeRegistryLike } from '@artinos/ui'

/** Parameters owned by the scene subsystems rather than by the project. */
const SCENE_PREFIX = /^(scene|camera|render|postfx)\./

/**
 * One row, subscribed to one parameter.
 *
 * Memoised and self-subscribing, so a value change re-renders this row alone.
 * That is what keeps a thousand-parameter Inspector usable, and what stops a
 * drag from re-rendering the whole panel on every pointermove.
 */
const ParameterRow = memo(function ParameterRow({
  definitions,
  revealed,
  favorite,
  pinned,
  onFavorite,
  onPin,
  onCopy,
  onPaste,
}: {
  definitions: ParameterDefinition[]
  revealed: boolean
  favorite: boolean
  pinned: boolean
  onFavorite(): void
  onPin(): void
  onCopy(): void
  onPaste(): void
}) {
  const definition = definitions[0]
  const view = useParameter(definition.id)
  const label = definition.label ?? definition.id
  const writer = useMultiParameter(definitions.map(item => item.id), `Set ${label}`)
  const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b)
  const isDefault = definitions.every((item, index) => same(writer.values[index], item.defaultValue))

  return (
    <PropertyRow
      label={label}
      binding={view.drivenBy}
      status={view.status}
      message={view.fault}
      mixed={writer.mixed}
      visibilityState={revealed ? 'revealed' : definition.advanced ? 'advanced' : definition.presentation?.readOnly ? 'disabled' : 'visible'}
      onReset={isDefault ? undefined : () => writer.set(definition.defaultValue)}
      actions={<details className="artinos-property-menu"><summary aria-label={`Actions for ${label}`} title={`Actions for ${label}`}><Ellipsis size={14} /></summary><div>
        <IconButton active={favorite} title={favorite ? `Unfavorite ${label}` : `Favorite ${label}`} onClick={onFavorite}><Star size={13} fill={favorite ? 'currentColor' : 'none'} /></IconButton>
        <IconButton active={pinned} title={pinned ? `Unpin ${label}` : `Pin ${label}`} onClick={onPin}><Pin size={13} /></IconButton>
        <IconButton title={`Copy ${label}`} onClick={onCopy}><Copy size={13} /></IconButton>
        <IconButton title={`Paste ${label}`} onClick={onPaste}><ClipboardPaste size={13} /></IconButton>
      </div></details>}
      density={definition.type === 'vec3' || definition.type === 'vec4' ? 'multiline' : 'default'}
    >
      <ParameterControl
        definition={definition}
        value={writer.values[0] ?? view.value}
        status={view.status}
        binding={view.drivenBy}
        onChange={writer.set}
        onGestureStart={writer.beginGesture}
        onGestureEnd={writer.endGesture}
        autoFocus={revealed}
      />
    </PropertyRow>
  )
})

export interface ParametersPanelProps {
  projectOnly?: boolean
  schema?: ControlSchemaDefinition
  /** Primary parameter id → equivalent ids on the rest of a multi-selection. */
  multiEdit?: Record<string, string[]>
  includeIds?: string[]
}

export function ParametersPanel({ projectOnly = false, schema, multiEdit = {}, includeIds }: ParametersPanelProps = {}) {
  const runtime = useArtinosRuntime()
  useEffect(() => {
    if (schema) materializeSchema(runtime as unknown as ParameterMaterializer, schema, runtime.parameterTypes as unknown as ParameterTypeRegistryLike)
  }, [runtime, schema])
  // Ids only: this re-renders when parameters appear or disappear, not when a
  // value moves. Values are subscribed per row.
  const ids = useParameterIds()
  const hasConditionalControls = ids.some(id => typeof runtime.parameters.state(id)?.definition.metadata?.visibleWhen === 'function')
  const conditionalRevision = useSyncExternalStore(
    callback => hasConditionalControls ? runtime.parameters.subscribeAllBase(callback) : () => {},
    () => hasConditionalControls ? runtime.parameters.baseRevision : 0,
    () => 0,
  )
  const [query, setQuery] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [filter, setFilter] = useState<'all' | 'favorites' | 'pinned'>('all')
  const [preferences, patchPreferences] = usePersistentState('artinos.inspector.preferences', { favorites: [] as string[], pins: [] as string[] })
  const [clipboard, setClipboard] = useState<string | null>(null)
  const presetRevision = useSyncExternalStore(callback => runtime.presets.subscribe(callback), () => runtime.presets.revision, () => 0)
  const presets = useMemo(() => runtime.presets.list().filter(preset => !projectOnly || !/^(scene|postfx):/.test(preset.id)), [runtime, presetRevision, projectOnly])
  const [presetId, setPresetId] = useState('')
  const [presetName, setPresetName] = useState('My look')
  const [showPresets, setShowPresets] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const togglePreference = (key: 'favorites' | 'pins', id: string) => {
    const values = new Set(preferences[key])
    values.has(id) ? values.delete(id) : values.add(id)
    patchPreferences({ [key]: [...values] })
  }
  const copyParameter = (id: string) => {
    const payload = JSON.stringify({ schema: 'artinos.parameter-value.v1', id, value: runtime.parameters.getBase(id) })
    setClipboard(payload)
    void navigator.clipboard?.writeText(payload).catch(() => undefined)
  }
  const pasteParameter = async (id: string) => {
    const raw = await navigator.clipboard?.readText().catch(() => '') || clipboard
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { value?: unknown }
      if ('value' in parsed) runtime.setParameter(id, parsed.value as never, `Paste ${id}`)
    } catch { runtime.logger.warn(`Clipboard does not contain an ARTINOS parameter value`, { source: 'inspector' }) }
  }

  // The palette can point at a parameter this panel is not currently showing; adopt the
  // id as the search query so the row is guaranteed to be visible after a reveal.
  const target = useReveal('parameter')
  useEffect(() => {
    if (target) setQuery(target.id)
  }, [target])

  const revealedId = target?.id
  const groups = useMemo(() => {
    const needle = query.toLowerCase()
    const visible: ParameterDefinition[] = []
    const currentValues = Object.fromEntries(runtime.parameters.list().map(state => [state.definition.id, state.baseValue]))
    for (const id of ids) {
      const definition = runtime.parameters.state(id)?.definition
      if (!definition) continue
      if (definition.presentation?.hidden) continue
      if (includeIds && !includeIds.includes(definition.id)) continue
      const visibleWhen = definition.metadata?.visibleWhen
      if (typeof visibleWhen === 'function') {
        if (!visibleWhen(currentValues)) continue
      }
      // A reveal is an explicit request for one parameter, so it overrides the panel's
      // own filters — otherwise "reveal" silently shows nothing for a scene parameter.
      if (definition.id !== revealedId) {
        if (projectOnly && SCENE_PREFIX.test(definition.id)) continue
        if (!advanced && definition.advanced) continue
        if (filter === 'favorites' && !preferences.favorites.includes(definition.id)) continue
        if (filter === 'pinned' && !preferences.pins.includes(definition.id)) continue
        if (!`${definition.id} ${definition.label ?? ''} ${definition.group ?? ''}`.toLowerCase().includes(needle)) continue
      }
      visible.push(definition)
    }
    visible.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const byGroup = new Map<string, ParameterDefinition[]>()
    for (const definition of visible) {
      const key = definition.group ?? 'General'
      const bucket = byGroup.get(key)
      if (bucket) bucket.push(definition)
      else byGroup.set(key, [definition])
    }
    return byGroup
  }, [ids, runtime, query, advanced, filter, preferences, projectOnly, includeIds, revealedId, conditionalRevision])

  const total = [...groups.values()].reduce((count, items) => count + items.length, 0)

  return (
    <div className="artinos-parameters-panel">
      <Toolbar>
        <SearchField value={query} onChange={setQuery} placeholder={projectOnly ? 'Search project controls' : 'Search controls'} />
        <Toggle label="Advanced" value={advanced} onChange={setAdvanced} />
        <Select label="View" value={filter} onChange={value => setFilter(value as typeof filter)} options={[
          { value: 'all', label: 'All' }, { value: 'favorites', label: 'Favorites' }, { value: 'pinned', label: 'Pinned' },
        ]} />
        <Button active={showPresets} onClick={() => setShowPresets(!showPresets)}>Presets</Button>
      </Toolbar>
      {showPresets && <div className="artinos-inspector-presets">
        <Select label="Saved look" value={presetId} onChange={setPresetId} options={[
          { value: '', label: 'Preset…' }, ...presets.map(preset => ({ value: preset.id, label: preset.label })),
        ]} />
        <Button disabled={!presetId} onClick={() => presetId && runtime.presets.apply(presetId)}>Apply</Button>
        <TextField label="New look" value={presetName} onChange={setPresetName} />
        <Button disabled={!total || !presetName.trim()} onClick={() => {
          const id = `inspector-${Date.now().toString(36)}`
          runtime.presets.capture(id, presetName.trim(), [...groups.values()].flat().map(definition => definition.id))
          setPresetId(id)
        }}>Save visible controls</Button>
      </div>}

      {projectOnly && ids.includes('glass.ior') && filter === 'all' && (!query || /glass|optic|monitor|refract/i.test(query)) && <GlassInspector />}
      {total > 0 && (
        <div className="artinos-parameter-cards">
          {[...groups.entries()].map(([group, items]) => {
            const open = Boolean(query) || !collapsed.includes(group)
            return <section className="artinos-parameter-card" key={group}>
              <button className="artinos-parameter-card-head" type="button" aria-expanded={open} onClick={() => setCollapsed(previous => previous.includes(group) ? previous.filter(item => item !== group) : [...previous, group])}><ChevronDown size={14} style={{ transform: open ? undefined : 'rotate(-90deg)' }} /><b>{group}</b><small>{items.length}</small></button>
              {open && <div className="artinos-parameter-card-body">{items.map(definition => (
            <ParameterRow
              key={definition.id}
              definitions={[
                definition,
                ...(multiEdit[definition.id] ?? [])
                  .map(id => runtime.parameters.state(id)?.definition)
                  .filter((definition): definition is ParameterDefinition => Boolean(definition)),
              ]}
              revealed={definition.id === revealedId}
              favorite={preferences.favorites.includes(definition.id)}
              pinned={preferences.pins.includes(definition.id)}
              onFavorite={() => togglePreference('favorites', definition.id)}
              onPin={() => togglePreference('pins', definition.id)}
              onCopy={() => copyParameter(definition.id)}
              onPaste={() => void pasteParameter(definition.id)}
            />
          ))}</div>}
            </section>
          })}
        </div>
      )}

      {!total && (
        <PanelEmpty title={query ? `No controls match “${query}”` : filter === 'all' ? 'No exposed controls' : `No ${filter} yet`} description={filter === 'all' ? 'Try a different search or show advanced controls.' : 'Return to All and star or pin the controls you use most.'} action={<Button onClick={() => { setQuery(''); setFilter('all'); setAdvanced(true) }}>Show all controls</Button>} />
      )}
    </div>
  )
}
