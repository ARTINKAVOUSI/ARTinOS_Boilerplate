import type { GraphDefinition } from '@artinos/graph'
import { postFXCatalog } from '@artinos/modules/postfx'
import type { ArtinosRuntime } from '@artinos/runtime'

export type LiveKind='signal'|'binding'|'graph'|'parameter'|'object'|'pass'|'effect'|'output'
export interface LiveNode{
  id:string
  kind:LiveKind
  title:string
  subtitle?:string
  detail?:string
  value?:number|string
  column:number
  x:number
  y:number
  height:number
  /** Runtime resource this node stands for, so the panel can preview it. */
  resourceId?:string
  /** What this node actually is, so the inspector can edit it rather than describe it. */
  target?:LiveTarget
  /** Controls drawn on the node body, wired straight through to the live thing. */
  controls:LiveControl[]
  /** `value` plots the node's own output, `render` shows its render target. */
  preview:'value'|'render'|'none'
  muted?:boolean
}
/** `parameterId` names the registered parameter that owns this value, when one does. */
export type LiveControl=
  |{kind:'number';id:string;label:string;value:number;min:number;max:number;step:number;parameterId?:string}
  |{kind:'boolean';id:string;label:string;value:boolean;parameterId?:string}
  |{kind:'readout';id:string;label:string;value:string}
export type LiveTarget=
  |{kind:'signal';id:string}
  |{kind:'parameter';id:string}
  |{kind:'effect';id:string}
  |{kind:'object';object:unknown}
  |{kind:'graph';id:string}
  |{kind:'binding';id:string}
  |{kind:'resource';id:string}
export interface LiveEdge{id:string;from:string;to:string;label?:string}
export interface LiveGraph{nodes:LiveNode[];edges:LiveEdge[];columns:string[]}

export const LIVE_COLUMNS=['Input','Logic','Parameters','Scene','Render']
const COL_W=252,COL_GAP=88,HEADER_H=42,ROW_H=25,PREVIEW_H=62,PAD=10,ROW_GAP=18
/** Height follows the node's real content, so the columns never overlap. */
const measure=(controls:readonly LiveControl[],preview:'value'|'render'|'none')=>
  HEADER_H+controls.length*ROW_H+(preview==='none'?0:PREVIEW_H+6)+PAD

interface SceneLike{traverse(visit:(object:SceneObject)=>void):void}
interface SceneObject{name?:string;type?:string;visible?:boolean;intensity?:number;isMesh?:boolean;isLight?:boolean;isCamera?:boolean;children?:unknown[]}
interface EffectLike{id:string;type:string;enabled?:boolean;order?:number;params?:Record<string,number|boolean>}

const SCENE_LIMIT=14
const short=(value:number)=>Number.isFinite(value)?(Math.abs(value)>=1000?value.toFixed(0):value.toFixed(3)):'—'

/**
 * Builds a read-only graph of what is actually running: the live signals being
 * produced, the bindings and graphs consuming them, the parameters they drive,
 * the real objects in the scene, and the render pipeline that draws them.
 *
 * Nothing here is authored — every node and edge is read back from the runtime,
 * the Three scene and the PostFX controller on the frame it is built.
 */
export function buildLiveGraph(
  runtime:ArtinosRuntime,
  scene:SceneLike|undefined,
  effects:readonly EffectLike[],
  graphs:readonly GraphDefinition[],
):LiveGraph{
  const nodes:LiveNode[]=[],edges:LiveEdge[]=[]
  const cursor=[0,0,0,0,0]
  const place=(node:Omit<LiveNode,'x'|'y'|'height'|'controls'|'preview'>&{controls?:LiveControl[];preview?:'value'|'render'|'none'}):LiveNode=>{
    const controls=node.controls??[],preview=node.preview??'none'
    const placed:LiveNode={...node,controls,preview,height:measure(controls,preview),x:node.column*(COL_W+COL_GAP),y:cursor[node.column]}
    cursor[node.column]+=placed.height+ROW_GAP
    nodes.push(placed)
    return placed
  }
  const has=(id:string)=>nodes.some(node=>node.id===id)
  const link=(from:string,to:string,label?:string)=>{
    if(!has(from)||!has(to))return
    const id=`${from}->${to}`
    if(!edges.some(edge=>edge.id===id))edges.push({id,from,to,label})
  }

  const bindings=runtime.bindings.list() as Array<{id:string;source:string;target:string;enabled?:boolean;amount?:number}>
  const liveGraphs=graphs.filter(graph=>graph.enabled!==false)

  // ── Which signals are actually consumed, plus anything currently moving ────
  const consumed=new Set<string>()
  for(const binding of bindings)consumed.add(binding.source)
  for(const graph of liveGraphs)for(const node of graph.nodes)if(node.type==='signal')consumed.add(String(node.data?.id??''))
  const samples=runtime.signals.list()
  const moving=new Set(samples.filter(sample=>typeof sample.value==='number'&&sample.previous!==undefined&&sample.value!==sample.previous).map(sample=>sample.id))
  const signalIds=[...new Set([...consumed,...moving])].filter(Boolean).sort()

  for(const id of signalIds){
    const sample=runtime.signals.sample(id)
    const value=typeof sample?.value==='number'?short(sample.value):sample?.value===undefined?'—':String(sample.value)
    place({id:`signal:${id}`,kind:'signal',title:id,subtitle:'signal',value,column:0,muted:!consumed.has(id),
      target:{kind:'signal',id},preview:typeof sample?.value==='number'?'value':'none'})
  }

  // ── Logic: bindings and authored graphs that write into parameters ────────
  for(const binding of bindings){
    place({id:`binding:${binding.id}`,kind:'binding',title:binding.id,subtitle:'binding',
      detail:binding.target,column:1,muted:binding.enabled===false,
      controls:[{kind:'number',id:'amount',label:'amount',value:binding.amount??1,min:-4,max:4,step:.01},
        {kind:'boolean',id:'enabled',label:'enabled',value:binding.enabled!==false}],
      target:{kind:'binding',id:binding.id}})
    link(`signal:${binding.source}`,`binding:${binding.id}`)
  }
  for(const graph of liveGraphs){
    const writes=graph.nodes.filter(node=>node.type==='write-parameter'||node.type==='write-signal')
    place({id:`graph:${graph.id}`,kind:'graph',title:graph.name??graph.id,subtitle:`${graph.domain??'signal'} graph`,
      detail:`${graph.nodes.length} nodes`,value:short(Number(runtime.telemetry.get(`graph.${graph.id}.ms`)?.value??0))+' ms',
      column:1,target:{kind:'graph',id:graph.id},
      controls:[{kind:'boolean',id:'enabled',label:'evaluate',value:graph.enabled!==false}]})
    for(const node of graph.nodes)if(node.type==='signal')link(`signal:${String(node.data?.id??'')}`,`graph:${graph.id}`)
    for(const write of writes){
      const target=String(write.data?.id??'')
      if(write.type==='write-signal')continue
      link(`graph:${graph.id}`,`parameter:${target}`)
    }
  }

  // ── Parameters that are actually driven ──────────────────────────────────
  const driven=new Set<string>()
  for(const binding of bindings)driven.add(binding.target)
  for(const graph of liveGraphs)for(const node of graph.nodes)if(node.type==='write-parameter')driven.add(String(node.data?.id??''))
  for(const id of [...driven].filter(Boolean).sort()){
    const state=runtime.parameters.state(id)
    if(!state)continue
    const resolved=state.resolvedValue
    place({id:`parameter:${id}`,kind:'parameter',title:id,subtitle:'parameter',
      detail:typeof state.baseValue==='number'?`base ${short(state.baseValue)}`:undefined,
      value:typeof resolved==='number'?short(resolved):String(resolved),column:2,target:{kind:'parameter',id},
      preview:typeof resolved==='number'?'value':'none',
      controls:typeof state.baseValue==='number'
        ?[{kind:'number',id:'base',label:'base',value:state.baseValue,parameterId:id,
            min:state.definition.min??0,max:state.definition.max??Math.max(1,state.baseValue*2),step:state.definition.step??.01}]
        :typeof state.baseValue==='boolean'
          ?[{kind:'boolean',id:'base',label:'base',value:state.baseValue,parameterId:id}]
          :[{kind:'readout',id:'base',label:'base',value:String(state.baseValue)}]})
  }
  for(const binding of bindings)link(`binding:${binding.id}`,`parameter:${binding.target}`)
  for(const graph of liveGraphs)for(const node of graph.nodes)if(node.type==='write-parameter')link(`graph:${graph.id}`,`parameter:${String(node.data?.id??'')}`)

  // ── Modules and the real scene in the viewport ───────────────────────────
  // A module manifest declares which parameters it owns, so this edge is a
  // fact rather than a guess from the parameter's name.
  const modules=runtime.modules.list().filter(manifest=>manifest.runtime==='r3f')
  const owners=new Map<string,string>()
  for(const manifest of modules)for(const parameter of manifest.parameters??[])owners.set(parameter.id,manifest.id)
  const usedModules=new Set([...driven].map(id=>owners.get(id)).filter(Boolean) as string[])
  for(const id of usedModules){
    const manifest=modules.find(item=>item.id===id)
    if(!manifest)continue
    place({id:`module:${id}`,kind:'object',title:manifest.name,subtitle:'module',detail:manifest.category,column:3})
  }
  for(const [parameterId,moduleId] of owners)if(driven.has(parameterId))link(`parameter:${parameterId}`,`module:${moduleId}`)

  const objects:SceneObject[]=[]
  let total=0,meshes=0,lights=0
  scene?.traverse(object=>{
    total++
    if(object.isMesh)meshes++
    if(object.isLight)lights++
    if(object.isMesh||object.isLight||object.isCamera)objects.push(object)
  })
  const shown=objects.slice(0,SCENE_LIMIT)
  for(const [index,object] of shown.entries()){
    const kindLabel=object.isMesh?'mesh':object.isLight?'light':'camera'
    place({id:`object:${object.name||kindLabel}-${index}`,kind:'object',
      title:object.name||object.type||kindLabel,subtitle:kindLabel,
      detail:object.type,column:3,muted:object.visible===false,target:{kind:'object',object},
      controls:[{kind:'boolean',id:'visible',label:'visible',value:object.visible!==false},
        ...(typeof object.intensity==='number'
          ?[{kind:'number',id:'intensity',label:'intensity',value:object.intensity,min:0,max:Math.max(4,object.intensity*2),step:.01} as LiveControl]
          :[])]})
  }
  if(objects.length>shown.length)place({id:'object:more',kind:'object',
    title:`+${objects.length-shown.length} more`,subtitle:'scene',column:3,muted:true})


  // ── Render pipeline, in real pipeline order ──────────────────────────────
  const scenePass=place({id:'pass:scene',kind:'pass',title:'Scene Pass',subtitle:'render',
    detail:`${meshes} meshes · ${lights} lights`,resourceId:'render.scenePass',column:4,preview:'render',target:{kind:'resource',id:'render.scenePass'}})
  for(const object of shown)link(`object:${object.name||(object.isMesh?'mesh':object.isLight?'light':'camera')}-${shown.indexOf(object)}`,scenePass.id)
  for(const id of usedModules)link(`module:${id}`,scenePass.id)
  for(const id of driven)if(id.startsWith('scene.')||id.startsWith('camera.')||id.startsWith('render.'))link(`parameter:${id}`,scenePass.id)

  // The G-buffer targets the pipeline produced, placed before the effects that consume them.
  const attachments:string[]=[]
  for(const attachment of ['depth','normal','velocity'] as const){
    if(!runtime.resources.get(`render.${attachment}`))continue
    attachments.push(attachment)
    const node=place({id:`pass:${attachment}`,kind:'pass',title:attachment,subtitle:'g-buffer',
      resourceId:`render.${attachment}`,column:4,preview:'render',target:{kind:'resource',id:`render.${attachment}`}})
    link(scenePass.id,node.id)
  }

  const active=[...effects].filter(effect=>effect.enabled!==false).sort((a,b)=>(a.order??0)-(b.order??0))

  let previous=scenePass.id
  for(const effect of active){
    const params=Object.entries(effect.params??{}).slice(0,3).map(([key,value])=>`${key} ${typeof value==='number'?short(value):value}`).join(' · ')
    // `postfx.<type>.<key>` parameters are what actually drive the effect; the
    // controller is downstream of them, so writing it directly is reverted the
    // next time the parameter tree renders. Bind the controls to the parameters.
    const controls:LiveControl[]=[]
    const enabledId=`postfx.${effect.type}.enabled`
    controls.push({kind:'boolean',id:enabledId,label:'enabled',
      value:Boolean(runtime.parameters.get(enabledId)??effect.enabled!==false),parameterId:enabledId})
    for(const [key,value] of Object.entries(effect.params??{})){
      const parameterId=`postfx.${effect.type}.${key}`
      const definition=runtime.parameters.state(parameterId)?.definition
      if(typeof value==='number')controls.push({kind:'number',id:parameterId,label:definition?.label??key,value,
        min:definition?.min??0,max:definition?.max??Math.max(1,Math.abs(value)*3),step:definition?.step??.01,
        parameterId:definition?parameterId:undefined})
      else controls.push({kind:'boolean',id:parameterId,label:definition?.label??key,value:Boolean(value),
        parameterId:definition?parameterId:undefined})
    }
    const node=place({id:`effect:${effect.id}`,kind:'effect',title:effect.type,subtitle:'postfx',column:4,
      target:{kind:'effect',id:effect.id},controls})
    link(previous,node.id)
    previous=node.id
    // The catalog declares which render targets an effect needs, so this is a
    // stated dependency rather than an inference from the effect's name.
    const requires=postFXCatalog.find(entry=>entry.type===effect.type)?.requires??[]
    for(const attachment of attachments)if(requires.includes(attachment))link(`pass:${attachment}`,node.id)
    // PostFX parameters follow the postfx.<type>.<key> convention.
    for(const id of driven)if(id.startsWith(`postfx.${effect.type}.`))link(`parameter:${id}`,node.id)
  }
  const output=place({id:'pass:output',kind:'output',title:'Output',subtitle:'canvas',
    detail:active.length?`${active.length} effect${active.length>1?'s':''}`:'no postfx',resourceId:'render.output',column:4,preview:'render',target:{kind:'resource',id:'render.output'}})
  link(previous,output.id)



  return {nodes,edges,columns:LIVE_COLUMNS}
}

export const liveGraphBounds=(graph:LiveGraph)=>{
  if(!graph.nodes.length)return {x:0,y:0,width:COL_W,height:HEADER_H}
  const right=Math.max(...graph.nodes.map(node=>node.x+COL_W))
  const bottom=Math.max(...graph.nodes.map(node=>node.y+node.height))
  return {x:0,y:0,width:right,height:bottom}
}
export const LIVE_NODE_WIDTH=COL_W
export const LIVE_PREVIEW_H=PREVIEW_H
export const LIVE_COLUMN_STEP=COL_W+COL_GAP
