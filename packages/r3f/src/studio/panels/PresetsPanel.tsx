import { useMemo, useState, useSyncExternalStore } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { Button, KeyValue, SearchField, Section, Select, Stack, TextField } from '../foundation'

export function PresetsPanel(){
  const runtime=useArtinosRuntime(),[query,setQuery]=useState(''),[group,setGroup]=useState('all'),[name,setName]=useState('My Preset')
  useSyncExternalStore(runtime.presets.subscribe.bind(runtime.presets),()=>runtime.presets.revision,()=>0)
  const all=runtime.presets.list(),groups=useMemo(()=>['all',...new Set(all.map(p=>p.group??'general'))],[all])
  const list=all.filter(p=>(group==='all'||(p.group??'general')===group)&&`${p.id} ${p.label} ${p.tags?.join(' ')??''}`.toLowerCase().includes(query.toLowerCase()))
  const capture=()=>{const id=`project:${slug(name)}:${Date.now().toString(36)}`;runtime.presets.capture(id,name,undefined,'project');runtime.persistence.save()}
  return <><Section title="Preset Library" description="Scene, PostFX and project parameter snapshots"><SearchField value={query} onChange={setQuery} placeholder="Search presets"/><Select label="Group" value={group} options={groups.map(value=>({label:value,value}))} onChange={setGroup}/><TextField label="New Preset" value={name} onChange={setName}/><Button disabled={!name.trim()} onClick={capture}>Capture Current Project</Button></Section><Section title="Available" description={`${list.length} presets`}><Stack>{list.map(p=><div className="artinos-binding" key={p.id}><KeyValue label={p.label} value={`${p.group??'general'} · ${Object.keys(p.values).length} values`}/><div className="artinos-button-row"><Button onClick={()=>runtime.presets.apply(p.id)}>Apply</Button>{p.group==='project'&&<Button onClick={()=>runtime.presets.remove(p.id)}>Delete</Button>}</div></div>)}</Stack></Section></>
}
const slug=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'preset'
