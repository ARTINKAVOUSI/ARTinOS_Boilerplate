import { useMemo, useState } from 'react'
import { listProviderExports, type ProviderExport } from '@artinos/modules'
import { Button, KeyValue, SearchField, Section, Segmented, Select, Toolbar } from '../foundation'

export function ProviderPanel(){
  const[provider,setProvider]=useState<'drei'|'three-stdlib'>('drei'),[items,setItems]=useState<ProviderExport[]>([]),[query,setQuery]=useState(''),[kind,setKind]=useState('all'),[loading,setLoading]=useState(false)
  const load=async(p=provider)=>{setLoading(true);try{setItems(await listProviderExports(p))}finally{setLoading(false)}}
  const kinds=useMemo(()=>['all',...new Set(items.map(i=>i.kind))],[items])
  const filtered=items.filter(i=>(kind==='all'||i.kind===kind)&&`${i.name} ${i.kind}`.toLowerCase().includes(query.toLowerCase())).slice(0,250)
  const packageName=provider==='drei'?'drei':'stdlib'
  const importLine=(name:string)=>`import { ${name} } from '@artinos/modules/${packageName}'`
  const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text)}catch{/* clipboard permission can be unavailable */}}
  return <>
    <Section title="PMNDRS Providers" description="Complete installed Drei / three-stdlib root export surfaces; loaded only when requested.">
      <Segmented value={provider} options={['drei','three-stdlib']} onChange={v=>{setProvider(v as any);setItems([]);setKind('all')}}/>
      <Button onClick={()=>load()} disabled={loading}>{loading?'Loading…':`Load ${provider}`}</Button>
      <KeyValue label="Provider role" value={provider==='drei'?'R3F abstractions':'Three addon primitives'}/>
    </Section>
    {items.length>0&&<>
      <Toolbar><SearchField value={query} onChange={setQuery} placeholder={`Search ${provider} exports…`}/></Toolbar>
      <Select label="Kind" value={kind} options={kinds.map(value=>({label:value,value}))} onChange={v=>setKind(String(v))}/>
      <Section title="Provider Exports" description={`${filtered.length}/${items.length} visible`}>
        <div className="artinos-provider-list">{filtered.map(i=><div key={i.name}><div className="artinos-module-head"><b>{i.name}</b><small>{i.kind}</small></div><code>{importLine(i.name)}</code><Button onClick={()=>copy(importLine(i.name))}>Copy import</Button></div>)}</div>
      </Section>
    </>}
  </>
}
