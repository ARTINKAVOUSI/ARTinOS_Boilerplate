import { useMemo, useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { Badge, Button, Empty, KeyValue, ListBrowser, Select, Tabs } from '@artinos/ui'
import { controls } from '@artinos/ui'
import { tokenManifest } from '@artinos/ui'
import { useComponentDevTools } from '@artinos/ui'

export function ComponentDevToolsPanel() {
  const runtime = useArtinosRuntime(); const registry = useComponentDevTools()
  const revision = useSyncExternalStore(callback => registry.subscribe(callback), () => registry.revision, () => 0)
  const [tab, setTab] = useState('instances'); const [selected, setSelected] = useState(''); const [simulation, setSimulation] = useState('none')
  const instances = useMemo(() => registry.list(), [registry, revision]); const instance = instances.find(item => item.id === selected) ?? instances[0]
  const definitions = controls.list(); const tokens = tokenManifest().tokens
  return <div className="artinos-devtools"><Tabs value={tab} onChange={setTab} items={['instances','components','parameters','tokens'].map(id => ({ id, label: id }))} />
    {tab === 'instances' && <><ListBrowser items={instances} searchable={item => `${item.id} ${item.component} ${item.parameter ?? ''}`} itemHeight={38} countLabel="instances" empty={<Empty>No instrumented components</Empty>}>{item => <button className={item.id === instance?.id ? 'is-active' : ''} onClick={() => setSelected(item.id)}>{item.component}<Badge>{item.state.disabled ? 'disabled' : 'live'}</Badge></button>}</ListBrowser>{instance && <div className="artinos-devtools-detail"><KeyValue label="Component" value={instance.component}/><KeyValue label="Parameter" value={instance.parameter ?? 'none'}/><KeyValue label="Anatomy" value={instance.anatomy?.join(' · ') || 'root'}/><KeyValue label="A11y" value={JSON.stringify(instance.accessibility ?? {})}/><KeyValue label="Layout" value={JSON.stringify(instance.layout ?? {})}/><KeyValue label="Source" value={instance.source ?? 'registry'}/><KeyValue label="Subscriptions" value={instance.subscriptions?.join(', ') || 'none'}/><Select label="Simulate" value={simulation} onChange={value => { setSimulation(value); value === 'none' ? registry.clearSimulation(instance.id) : registry.simulate(instance.id, { [value]: true }) }} options={['none','hover','focus','active','disabled','mixed','fault']}/><Button onClick={() => registry.clearSimulation(instance.id)}>Clear simulation</Button></div>}</>}
    {tab === 'components' && <ListBrowser items={definitions} searchable={item => `${item.id} ${item.name}`} itemHeight={44} countLabel="components">{item => <div><strong>{item.name}</strong><small>{item.slots.join(' · ')} · {item.accessibility.role ?? 'semantic'}</small></div>}</ListBrowser>}
    {tab === 'parameters' && <ListBrowser items={runtime.parameters.list()} searchable={item => `${item.definition.id} ${item.definition.label ?? ''}`} itemHeight={44} countLabel="parameters">{item => <div><strong>{item.definition.label ?? item.definition.id}</strong><small>{item.definition.type} · {item.source ?? 'default'} · rev {item.baseRevision}</small></div>}</ListBrowser>}
    {tab === 'tokens' && <ListBrowser items={tokens} searchable={item => `${item.id} ${item.layer}`} itemHeight={40} countLabel="tokens">{item => <div><code>{item.id}</code><Badge>{item.layer}</Badge></div>}</ListBrowser>}
  </div>
}
