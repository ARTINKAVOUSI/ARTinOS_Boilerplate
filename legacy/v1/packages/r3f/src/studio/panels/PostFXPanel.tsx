import { useState, useSyncExternalStore } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Power } from 'lucide-react'
import { postFXCatalog, defs } from '@artinos/modules'
import { useArtinosRuntime, useParameter, type PostFXController } from '@artinos/runtime'
import { Button, ParameterControl, SearchField, Select, Tabs, Toggle, Toolbar, useParameters } from '../foundation'
import { PanelEmpty } from '@artinos/ui'

export function PostFXPanel() {
  const runtime = useArtinosRuntime()
  useSyncExternalStore(callback => runtime.presets.subscribe(callback), () => runtime.presets.revision, () => 0)
  useSyncExternalStore(callback => runtime.resources.subscribe(callback), () => runtime.resources.revision, () => 0)
  const controller = runtime.resources.get<PostFXController>('postfx.controller')
  useSyncExternalStore(controller ? callback => controller.subscribe(callback) : () => () => {}, () => controller?.revision ?? 0, () => 0)
  const [master, setMaster] = useParameter(defs.postfxEnabled), params = useParameters()
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [view, setView] = useState('all'), [expanded, setExpanded] = useState<string | null>(null)
  const runtimeStates = controller?.runtimeSnapshot() ?? []
  const entries = postFXCatalog.map(entry => {
    const states = params.filter(parameter => parameter.definition.group === `PostFX / ${entry.label}`)
    const enabled = states.find(parameter => parameter.definition.id.endsWith('.enabled')), order = states.find(parameter => parameter.definition.id.endsWith('.order'))
    return { entry, states, enabled, order, isEnabled: Boolean(enabled?.baseValue), runtimeState: runtimeStates.find(effect => effect.id === `project.${entry.type}`) }
  }).sort((a, b) => Number(a.order?.baseValue ?? 0) - Number(b.order?.baseValue ?? 0) || a.entry.label.localeCompare(b.entry.label))
  const active = entries.filter(item => item.isEnabled)
  const effects = entries.filter(item => (view !== 'active' || item.isEnabled) && (category === 'all' || item.entry.category === category) && `${item.entry.label} ${item.entry.category}`.toLowerCase().includes(query.toLowerCase()))
  const move = (type: string, offset: number) => {
    const ordered = view === 'active' ? active : entries, index = ordered.findIndex(item => item.entry.type === type), next = ordered[index + offset]
    if (!next) return
    const reordered = [...ordered]; [reordered[index], reordered[index + offset]] = [reordered[index + offset], reordered[index]]
    const all = view === 'active' ? entries.map(item => item.isEnabled ? reordered.shift()! : item) : reordered
    runtime.transact('Reorder effects', () => all.forEach((item, i) => { if (item.order) runtime.setParameter(item.order.definition.id, (i + 1) * 100) }))
  }
  return <div className="artinos-postfx-layout">
    <Toolbar><Toggle label="Effects pipeline" value={Boolean(master)} onChange={setMaster} /><span className="artinos-panel-summary">{active.length} enabled · {runtimeStates.filter(item => item.state === 'active' || item.state === 'fallback').length} rendering</span><Select label="Look" value="" options={[{ value: '', label: 'Apply a preset…' }, ...runtime.presets.list('postfx').map(preset => ({ value: preset.id, label: preset.label }))]} onChange={id => { if (id) runtime.presets.apply(id) }} /><Button disabled={!active.length} onClick={() => runtime.transact('Disable all effects', () => active.forEach(item => { if (item.enabled) runtime.setParameter(item.enabled.definition.id, false) }))}>Disable all</Button></Toolbar>
    <Tabs value={view} onChange={setView} items={[{ id: 'all', label: `Effect library (${entries.length})` }, { id: 'active', label: `Active stack (${active.length})` }]} />
    <Toolbar><SearchField value={query} onChange={setQuery} placeholder="Search effects" /><Select label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...[...new Set(postFXCatalog.map(effect => effect.category))].map(value => ({ value, label: value }))]} /></Toolbar>
    {!master && <div className="artinos-panel-notice" role="status">Pipeline bypassed. Your effects stay configured; enable the pipeline to render them.</div>}
    {!effects.length && <PanelEmpty title={view === 'active' && !active.length ? 'Build your effect stack' : 'No matching effects'} description={view === 'active' ? 'Open the effect library and enable an effect to add it here.' : 'Try another search or category.'} action={<Button onClick={() => { setView('all'); setQuery(''); setCategory('all') }}>Browse effects</Button>} />}
    <div className="artinos-postfx-grid">{effects.map(({ entry, states, enabled, order, isEnabled, runtimeState }) => {
      const isExpanded = expanded === entry.type, status = !master && isEnabled ? 'bypassed' : runtimeState?.state ?? (isEnabled ? 'pending' : 'disabled')
      const ordered = view === 'active' ? active : entries, index = ordered.findIndex(item => item.entry.type === entry.type)
      return <article key={entry.type} className={`artinos-effect ${isEnabled ? 'is-enabled' : ''} is-${status} ${isExpanded ? 'is-expanded' : ''}`}>
        <div className="artinos-effect-head">
          <button type="button" className={`artinos-effect-power ${isEnabled ? 'is-active' : ''}`} disabled={!enabled} title={`${isEnabled ? 'Disable' : 'Enable'} ${entry.label}`} aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${entry.label}`} aria-pressed={isEnabled} onClick={() => { if (enabled) runtime.setParameter(enabled.definition.id, !isEnabled) }}><Power size={14} /></button>
          <button type="button" className="artinos-effect-expand" aria-expanded={isExpanded} aria-label={`${entry.label} settings`} onClick={() => setExpanded(isExpanded ? null : entry.type)}><span className="artinos-effect-name"><b>{entry.label}</b><small>{entry.category}{entry.requires?.length ? ` · ${entry.requires.join(' + ')}` : ''}</small></span><span className={`artinos-effect-cost cost-${entry.cost}`}>{status === 'active' ? entry.cost : status}</span><ChevronDown size={14} /></button>
        </div>
        {isExpanded && <div className="artinos-effect-body">
          {runtimeState?.reason && status !== 'active' && status !== 'disabled' && <small className="artinos-effect-status">{runtimeState.reason}</small>}
          <div className="artinos-effect-order"><span>Pipeline order <b>{Number(order?.baseValue ?? 0)}</b></span><div><button disabled={index <= 0} aria-label={`Move ${entry.label} earlier`} onClick={() => move(entry.type, -1)}><ArrowUp size={14} /></button><button disabled={index === ordered.length - 1} aria-label={`Move ${entry.label} later`} onClick={() => move(entry.type, 1)}><ArrowDown size={14} /></button></div></div>
          {states.filter(parameter => parameter !== enabled && parameter !== order).map(parameter => <ParameterControl key={parameter.definition.id} definition={parameter.definition} value={parameter.baseValue} onChange={value => runtime.setParameter(parameter.definition.id, value)} onGestureStart={() => runtime.beginTransaction(`Adjust ${entry.label}`)} onGestureEnd={() => runtime.commitTransaction()} />)}
        </div>}
      </article>
    })}</div>
  </div>
}
