import { useMemo } from 'react'
import type { ArtinosRuntime, PostFXController } from '@artinos/runtime'
import { Badge, Button, KeyValue, NumberField, Slider, Sparkline, Toggle } from '@artinos/ui'
import { ParameterControl } from '../../primitives/ParameterControl'
import { Section, Stack } from '@artinos/ui'
import { ValuePreview } from './GraphNodePreview'
import type { LiveNode } from './live-graph'

interface Object3DLike{name?:string;type?:string;visible?:boolean;position?:{x:number;y:number;z:number;set(x:number,y:number,z:number):void};intensity?:number;isLight?:boolean}

/**
 * Edits the thing a live node stands for. Everything here writes through the
 * same runtime surfaces the panels use, so the viewport reacts immediately.
 */
export function LiveInspector({node,runtime,controller,onOpenGraph}:{
  node:LiveNode|null
  runtime:ArtinosRuntime
  controller?:PostFXController
  onOpenGraph(id:string):void
}){
  if(!node?.target)return <Section title="Live" description="Select a node to inspect and tweak what it stands for.">
    <KeyValue label="Selection" value="Nothing selected"/>
  </Section>
  const target=node.target
  if(target.kind==='signal')return <SignalInspector id={target.id} runtime={runtime}/>
  if(target.kind==='parameter')return <ParameterInspector id={target.id} runtime={runtime}/>
  if(target.kind==='effect')return <EffectInspector id={target.id} controller={controller} runtime={runtime}/>
  if(target.kind==='object')return <ObjectInspector object={target.object as Object3DLike}/>
  if(target.kind==='graph')return <Section title={node.title} description="Authored graph feeding this system.">
    <KeyValue label="Evaluation" value={String(node.value??'—')}/>
    <Button onClick={()=>onOpenGraph(target.id)}>Open in editor</Button>
  </Section>
  return <Section title={node.title} description="Render target sampled from the live pipeline.">
    <KeyValue label="Resource" value={target.id}/>
    <KeyValue label="Detail" value={node.detail??'—'}/>
  </Section>
}

function SignalInspector({id,runtime}:{id:string;runtime:ArtinosRuntime}){
  const history=runtime.signals.history(id)
  const sample=runtime.signals.sample(id)
  const value=sample?.value
  return <Section title={id} description="Live signal. Devices own this value; it is read-only here.">
    <KeyValue label="Value" value={typeof value==='number'?value.toFixed(4):String(value??'—')}/>
    <KeyValue label="Updated" value={sample?`${Math.max(0,performance.now()-sample.timestamp).toFixed(0)}ms ago`:'—'}/>
    {history.length>1
      ?<Sparkline values={history.slice(-90)}/>
      :<ValuePreview nodeKey={`live-signal:${id}`} value={typeof value==='number'?value:0}/>}
  </Section>
}

function ParameterInspector({id,runtime}:{id:string;runtime:ArtinosRuntime}){
  const state=runtime.parameters.state(id)
  if(!state)return <Section title={id}><KeyValue label="Status" value="Not registered"/></Section>
  const modulated=state.baseValue!==state.resolvedValue
  return <Section title={state.definition.label??id} description={state.definition.description??'Parameter driven by the live system.'}>
    <ParameterControl definition={state.definition} value={state.baseValue}
      onChange={next=>runtime.setParameter(id,next,`Set ${state.definition.label??id}`)}/>
    <KeyValue label="Base" value={typeof state.baseValue==='number'?state.baseValue.toFixed(4):String(state.baseValue)}/>
    <KeyValue label="Resolved" value={typeof state.resolvedValue==='number'?state.resolvedValue.toFixed(4):String(state.resolvedValue)}/>
    {modulated&&<div className="artinos-grow-diagnostic">
      <Badge tone="accent">modulated</Badge>
      <span>A binding or graph is writing the resolved value, so editing the base only shifts the result.</span>
    </div>}
  </Section>
}

/**
 * PostFX effects are rendered from their `postfx.<type>.<key>` parameters, so
 * every control here writes the parameter. Writing the controller instead looks
 * like it works and is then reverted the next time that tree renders.
 */
function EffectInspector({id,controller,runtime}:{id:string;controller?:PostFXController;runtime:ArtinosRuntime}){
  const effect=controller?.snapshot().find(item=>item.id===id)
  if(!effect||!controller)return <Section title={id}><KeyValue label="Status" value="Not in the pipeline"/></Section>
  const owned=(key:string)=>runtime.parameters.state(`postfx.${effect.type}.${key}`)
  const write=(key:string,value:number|boolean)=>{
    const state=owned(key)
    if(state)runtime.setParameter(state.definition.id,value,`Set ${state.definition.label??key}`)
    else controller.update(id,{params:{...effect.params,[key]:value}})
  }
  const entries=Object.entries(effect.params??{}) as Array<[string,number|boolean]>
  return <Section title={effect.type} description="PostFX effect in the one shared pipeline.">
    <Toggle label="Enabled" value={effect.enabled!==false} onChange={next=>write('enabled',next)}/>
    <NumberField label="Order" value={effect.order??0} step={10} onChange={next=>write('order',next)}/>
    <Stack>
      {entries.map(([key,value])=>{
        const definition=owned(key)?.definition
        return typeof value==='number'
          ?<Slider key={key} label={definition?.label??key} value={value}
              min={definition?.min??0} max={definition?.max??Math.max(2,Math.abs(value)*3)} step={definition?.step??.01}
              onChange={next=>write(key,next)}/>
          :<Toggle key={key} label={definition?.label??key} value={value} onChange={next=>write(key,next)}/>
      })}
    </Stack>
    {!entries.length&&<KeyValue label="Parameters" value="This effect has none"/>}
  </Section>
}

function ObjectInspector({object}:{object:Object3DLike}){
  const position=useMemo(()=>object.position,[object])
  return <Section title={object.name||object.type||'Object'} description="Live object in the rendered scene.">
    <Toggle label="Visible" value={object.visible!==false} onChange={next=>{object.visible=next}}/>
    <KeyValue label="Type" value={object.type??'—'}/>
    {typeof object.intensity==='number'&&<Slider label="Intensity" value={object.intensity} min={0} max={Math.max(4,object.intensity*2)} step={.01}
      onChange={next=>{object.intensity=next}}/>}
    {position&&<>
      <Slider label="Position X" value={position.x} min={-10} max={10} step={.01} onChange={next=>position.set(next,position.y,position.z)}/>
      <Slider label="Position Y" value={position.y} min={-10} max={10} step={.01} onChange={next=>position.set(position.x,next,position.z)}/>
      <Slider label="Position Z" value={position.z} min={-10} max={10} step={.01} onChange={next=>position.set(position.x,position.y,next)}/>
    </>}
  </Section>
}
