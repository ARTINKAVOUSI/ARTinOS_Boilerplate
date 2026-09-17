import { useState } from 'react'
import { useArtinosRuntime } from '@artinos/runtime'
import { Button, KeyValue, NumberField, Section, Select, Slider, Toggle, useParameters, useSignals } from '../foundation'

export function BindingsPanel(){
  const runtime=useArtinosRuntime(),signals=useSignals().filter(s=>typeof s.value==='number'),params=useParameters().filter(p=>p.definition.type==='number'&&p.definition.modulatable!==false)
  const[source,setSource]=useState('audio.bass'),[target,setTarget]=useState('visual.orb.energy'),[mode,setMode]=useState('add'),[amount,setAmount]=useState(1),[offset,setOffset]=useState(0),[smooth,setSmooth]=useState(.15),[deadzone,setDeadzone]=useState(0),[curve,setCurve]=useState(1),[inMin,setInMin]=useState(0),[inMax,setInMax]=useState(1),[outMin,setOutMin]=useState(0),[outMax,setOutMax]=useState(1),[clamp,setClamp]=useState(true),[invert,setInvert]=useState(false),[,force]=useState(0)
  const refresh=()=>force(v=>v+1)
  const add=()=>{if(!source||!target)return;runtime.bindings.add({id:`binding:${source}:${target}:${Date.now()}`,source,target,mode:mode as any,input:[inMin,inMax],output:[outMin,outMax],amount,offset,smooth,deadzone,curve,clamp,invert});refresh()}
  const remove=(id:string)=>{runtime.bindings.remove(id);refresh()}
  const active=runtime.bindings.list()
  return <>
    <Section title="Create Binding" description="Map any numeric signal to any modulatable numeric parameter without React-frame state.">
      <Select label="Signal" value={source} options={signals.map(s=>({label:s.id,value:s.id}))} onChange={setSource}/><Select label="Parameter" value={target} options={params.map(p=>({label:p.definition.label??p.definition.id,value:p.definition.id}))} onChange={setTarget}/><Select label="Mode" value={mode} options={['add','replace','multiply'].map(value=>({label:value,value}))} onChange={setMode}/><NumberField label="Input Min" value={inMin} onChange={setInMin}/><NumberField label="Input Max" value={inMax} onChange={setInMax}/><NumberField label="Output Min" value={outMin} onChange={setOutMin}/><NumberField label="Output Max" value={outMax} onChange={setOutMax}/><Slider label="Amount" value={amount} min={-5} max={5} step={.05} onChange={setAmount}/><NumberField label="Offset" value={offset} onChange={setOffset}/><Slider label="Smoothing" value={smooth} min={0} max={1} step={.01} onChange={setSmooth}/><Slider label="Deadzone" value={deadzone} min={0} max={1} step={.01} onChange={setDeadzone}/><Slider label="Curve" value={curve} min={.1} max={4} step={.05} onChange={setCurve}/><Toggle label="Clamp" value={clamp} onChange={setClamp}/><Toggle label="Invert" value={invert} onChange={setInvert}/><Button onClick={add}>Add Binding</Button>
    </Section>
    <Section title="Active Bindings" description={`${active.length} modulation routes`}>
      {active.map(b=><div className="artinos-binding" key={b.id}><Toggle label={`${b.source} → ${b.target}`} value={b.enabled!==false} onChange={enabled=>{runtime.bindings.setEnabled(b.id,enabled);refresh()}}/><KeyValue label="Mode" value={b.mode??'add'}/><small>map {b.input?.join('..')??'0..1'} → {b.output?.join('..')??'0..1'} · amount {b.amount??1} · smooth {b.smooth??1}</small><div className="artinos-button-row"><Button onClick={()=>{runtime.bindings.update(b.id,{amount:Math.max(-5,Math.min(5,(b.amount??1)-.1))});refresh()}}>− Amount</Button><Button onClick={()=>{runtime.bindings.update(b.id,{amount:Math.max(-5,Math.min(5,(b.amount??1)+.1))});refresh()}}>+ Amount</Button><Button onClick={()=>remove(b.id)}>Remove</Button></div></div>)}
      {!active.length&&<KeyValue label="Status" value="No active bindings"/>}
    </Section>
  </>
}
