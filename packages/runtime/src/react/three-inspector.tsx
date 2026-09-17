import { useThree } from '@react-three/fiber'
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Inspector as ThreeInspector } from 'three/addons/inspector/Inspector.js'
import { useArtinosRuntime, useResource } from './runtime'

export interface ThreeInspectorController {
  ensure(): ThreeInspector
  show(tab?: ThreeInspectorTab): void
  hide(): void
  isVisible(): boolean
  activeTab(): ThreeInspectorTab | undefined
  attach(host:HTMLElement): void
  detach(host:HTMLElement): void
  subscribe(listener:()=>void):()=>void
  getRenderer(): unknown
}
export type ThreeInspectorTab='performance'|'memory'|'timeline'|'viewer'|'parameters'|'console'|'settings'

const stoppedEvents=['pointerdown','pointermove','pointerup','wheel','contextmenu','click','dblclick'] as const
const words=(value:string)=>value.replace(/^render\./,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._/-]+/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())
const isObject=(value:unknown):value is Record<string,any>=>value!==null&&(typeof value==='object'||typeof value==='function')
const autoInspectorName=/^(?:Pass|Render|Pipeline|Scene|PostFX)\s*\//
const inspectorName=(node:unknown)=>isObject(node)?String(node.getName?.()??node.name??''):''
const pruneAutoInspectors=(node:unknown)=>{if(!isObject(node)||!Array.isArray(node._beforeNodes))return;node._beforeNodes=node._beforeNodes.filter((entry:any)=>entry?.isInspectorNode!==true||(!(entry.__artinosAutoInspector===true)&&!autoInspectorName.test(inspectorName(entry))))}
const addInspector=(node:unknown,name:string)=>{if(!isObject(node)||typeof node.toInspector!=='function')return undefined;pruneAutoInspectors(node);const before=new Set(node._beforeNodes??[]);node.toInspector(name);const inspector=(node._beforeNodes??[]).find((entry:any)=>entry?.isInspectorNode===true&&!before.has(entry))??(node._beforeNodes??[]).find((entry:any)=>entry?.isInspectorNode===true&&inspectorName(entry)===name);if(inspector)inspector.__artinosAutoInspector=true;return inspector}
const syncRenderGraph=(pipeline:unknown,passes:unknown,resources:readonly {id:string;resource:unknown}[])=>{const records=new Map(resources.map(record=>[record.id,record.resource])),candidates:any[]=[],seen=new WeakSet<object>(),addCandidate=(node:unknown)=>{if(!isObject(node)||seen.has(node))return;seen.add(node);candidates.push(node)},addPass=(pass:unknown)=>{if(!isObject(pass))return;addCandidate(pass);for(const node of Object.values(pass._textureNodes??{}))addCandidate(node)}
  if(isObject(passes))for(const pass of Object.values(passes))addPass(pass)
  for(const record of resources)if(record.id.startsWith('render.')){if(isObject(record.resource)&&record.resource.isPassNode)addPass(record.resource);else addCandidate(record.resource)}
  if(isObject(pipeline)){addCandidate(pipeline.outputNode);pipeline.outputNode?.traverse?.((node:any)=>{if(node?.isPassNode)addPass(node);else if(node?.isPassTextureNode)addPass(node.passNode);else addCandidate(node)})}
  for(const node of candidates)pruneAutoInspectors(node)

  const inspectors:any[]=[],registered=new WeakSet<object>(),register=(node:unknown,name:string)=>{if(!isObject(node)||registered.has(node))return;registered.add(node);const inspector=addInspector(node,name);if(inspector)inspectors.push(inspector)}
  const scenePass=records.get('render.scenePass')??(isObject(passes)?passes.scene:undefined)
  if(isObject(scenePass)){
    register(scenePass,'Scene / Beauty')
    const available=new Set<string>([...Object.keys(scenePass._textures??{}),...Object.keys(scenePass._textureNodes??{}),...Object.keys(scenePass._mrt?.outputNodes??{})])
    for(const attachment of ['depth','normal','velocity'])if(available.has(attachment)){try{register(scenePass.getTextureNode?.(attachment),`Scene / ${words(attachment)}`)}catch{}}
  }
  const finalOutput=records.get('render.output')??(isObject(pipeline)?pipeline.outputNode:undefined)
  if(finalOutput!==scenePass)register(finalOutput,'PostFX / Final Output')
  for(const record of resources)if(record.id.startsWith('render.')&&isObject(record.resource)&&record.resource.isPassNode&&record.resource!==scenePass)register(record.resource,`Pass / ${words(record.id)}`)
  if(inspectors.length&&isObject(pipeline))pipeline.needsUpdate=true
  return inspectors
}

/** Source-faithful R3F integration of Three r185's official WebGPU Inspector. */
export function ThreeInspectorRuntime({visible=false}:{visible?:boolean}){
  const runtime=useArtinosRuntime(),renderer=useThree((state:any)=>state.gl),events=useThree((state:any)=>state.events),set=useThree((state:any)=>state.set),advance=useThree((state:any)=>state.advance),scheduler=useThree((state:any)=>state.internal?.scheduler),frameloop=useThree((state:any)=>state.frameloop),postProcessing=useThree((state:any)=>state.postProcessing),passes=useThree((state:any)=>state.passes)
  const resourceRevision=useSyncExternalStore(runtime.resources.subscribe.bind(runtime.resources),()=>runtime.resources.revision,()=>0)
  const graphRef=useRef<any[]>([])
  useLayoutEffect(()=>{
    const current=(renderer as any).inspector
    const inspector:ThreeInspector=current?.domElement&&current?.profiler?current:new ThreeInspector()
    ;(renderer as any).inspector=inspector
    inspector.init()
    const nativeInspect=inspector.inspect.bind(inspector);inspector.inspect=(node:any)=>{if(!(inspector as any).currentNodes?.includes(node))nativeInspect(node)}
    const viewer=(inspector as any).viewer,nativeViewerUpdate=viewer.update.bind(viewer);let lastViewerUpdate=-Infinity
    viewer.update=(source:any)=>{const now=performance.now();if(viewer.isActive&&now-lastViewerUpdate<250)return;lastViewerUpdate=now;nativeViewerUpdate(source)}
    const dom=inspector.domElement as HTMLElement,host=renderer.domElement?.parentElement
    dom.classList.add('artinos-three-inspector-integrated')
    if(!dom.parentElement&&host)host.appendChild(dom)
    const stop=(event:Event)=>event.stopPropagation()
    for(const name of stoppedEvents)dom.addEventListener(name,stop)
    const previousTarget=events.connected
    events.connect?.(renderer.domElement)
    set({frameloop:'never'})
    // R3F v10 applies the store's frameloop only when the root is created; its scheduler keeps
    // its own rAF loop. While the inspector drives frames that loop must stop, or every frame
    // (update, render and post-processing) runs twice and the second run sees delta 0.
    const schedulerLoop=scheduler?.frameloop
    if(scheduler)scheduler.frameloop='never'
    renderer.setAnimationLoop((time:number)=>advance(time))
    const listeners=new Set<()=>void>(),notify=()=>listeners.forEach(listener=>listener()),panel=(inspector as any).profiler.panel as HTMLElement
    let activeTab:ThreeInspectorTab|undefined,embeddedHost:HTMLElement|undefined
    const setVisible=(next:boolean,tab?:ThreeInspectorTab)=>{if(tab){const target=(inspector as any)[tab];if(target){inspector.setActiveTab(target);activeTab=tab}}if(next!==panel.classList.contains('visible'))(inspector as any).profiler.togglePanel();notify()}
    const attach=(target:HTMLElement)=>{embeddedHost=target;target.appendChild(dom);dom.classList.add('artinos-three-inspector-embedded');setVisible(true,activeTab??'performance')}
    const detach=(target:HTMLElement)=>{if(embeddedHost!==target)return;embeddedHost=undefined;dom.classList.remove('artinos-three-inspector-embedded');host?.appendChild(dom);setVisible(false);inspector.setActiveTab((inspector as any).performance);activeTab='performance'}
    const controller:ThreeInspectorController={ensure:()=>inspector,show:tab=>setVisible(true,tab),hide:()=>setVisible(false),isVisible:()=>panel.classList.contains('visible'),activeTab:()=>activeTab,attach,detach,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},getRenderer:()=>renderer}
    const release=runtime.resources.set('three.inspector',controller,{kind:'inspector',owner:'@artinos/runtime'}),observe=new MutationObserver(notify)
    observe.observe(panel,{attributes:true,attributeFilter:['class']})
    runtime.telemetry.set('inspector.three.ready',true,{group:'runtime'})
    setVisible(visible)
    const nativeBegin=inspector.begin.bind(inspector);inspector.begin=()=>{nativeBegin();for(const node of graphRef.current)inspector.inspect(node)}
    return()=>{inspector.begin=nativeBegin;inspector.inspect=nativeInspect;viewer.update=nativeViewerUpdate;observe.disconnect();release();dom.classList.remove('artinos-three-inspector-integrated','artinos-three-inspector-embedded');for(const name of stoppedEvents)dom.removeEventListener(name,stop);renderer.setAnimationLoop(null);if(scheduler&&schedulerLoop)scheduler.frameloop=schedulerLoop;set({frameloop});if(previousTarget)events.connect?.(previousTarget);else events.disconnect?.();panel.classList.remove('visible')}
  // Match the reference lifecycle: renderer identity owns this bridge. Including
  // frameloop here would retrigger the effect after set({ frameloop: 'never' }).
  },[renderer])
  useEffect(()=>{const resources=runtime.resources.list();graphRef.current=syncRenderGraph(postProcessing,passes,resources);runtime.telemetry.set('inspector.renderNodes',graphRef.current.length,{group:'runtime'});return()=>{graphRef.current=[]}},[postProcessing,passes,resourceRevision,runtime])
  return null
}

export interface InspectorControl<V>{value:V;label?:string;min?:number;max?:number;step?:number;color?:boolean;options?:readonly V[]|Record<string,V>;onChange?:(value:V)=>void}
export interface InspectorFolder<S extends InspectorControlSchema=InspectorControlSchema>{label?:string;collapsed?:boolean;schema:S}
export type InspectorControlSchema=Record<string,InspectorControl<any>|InspectorFolder<any>>
export type InspectorControlValues<S extends InspectorControlSchema>={[K in keyof S]:S[K] extends InspectorFolder<infer F>?InspectorControlValues<F>:S[K] extends InspectorControl<infer V>?V:never}
export interface ThreeInspectorControlsOptions{title?:string;collapsed?:boolean}
interface Editor{onChange(callback:(value:unknown)=>void):unknown;name(label:string):unknown}
interface Group{paramList:unknown;add(object:object,property:string,...params:unknown[]):Editor;addColor(object:object,property:string):Editor;addFolder(name:string):Group;close():unknown}
interface Parameters{createGroup(name:string):Group;paramList:{remove(item:unknown):unknown};groups:unknown[];show():void}
const isFolder=(entry:InspectorControl<any>|InspectorFolder<any>):entry is InspectorFolder<any>=>(entry as InspectorFolder<any>).schema!==undefined
const isColor=(value:unknown)=>(value as any)?.isColor===true||(typeof value==='string'&&/^#[0-9a-fA-F]{3,8}$/.test(value))
const initial=(schema:InspectorControlSchema):Record<string,unknown>=>Object.fromEntries(Object.entries(schema).map(([key,entry]):[string,unknown]=>[key,isFolder(entry)?initial(entry.schema):entry.value]))
const setIn=(object:Record<string,unknown>,path:readonly string[],value:unknown):Record<string,unknown>=>{const[head,...rest]=path;return{...object,[head]:rest.length?setIn(object[head] as Record<string,unknown>,rest,value):value}}
const addEditor=(group:Group,backing:Record<string,unknown>,key:string,control:InspectorControl<any>)=>{backing[key]=control.value;if(control.options!==undefined)return group.add(backing,key,control.options);if(control.color||isColor(control.value))return group.addColor(backing,key);if(typeof control.value==='number'&&control.min!==undefined&&control.max!==undefined)return group.add(backing,key,control.min,control.max,control.step);if(typeof control.value==='number'&&control.min!==undefined)return group.add(backing,key,control.min);return group.add(backing,key)}

/** Bind reactive controls into the official Inspector Parameters tab. */
export function useThreeInspectorControls<S extends InspectorControlSchema>(schema:S,options:ThreeInspectorControlsOptions={}):InspectorControlValues<S>{
  const controller=useResource<ThreeInspectorController>('three.inspector'),id=useId(),schemaRef=useRef(schema),[values,setValues]=useState(()=>initial(schema) as InspectorControlValues<S>);schemaRef.current=schema
  useEffect(()=>{if(!controller)return;const parameters=(controller.ensure() as any).parameters as Parameters,root=parameters.createGroup(options.title??`Controls ${id}`)
    const populate=(group:Group,current:InspectorControlSchema,path:readonly string[])=>{const backing:Record<string,unknown>={};for(const key in current){const entry=current[key];if(isFolder(entry)){const folder=group.addFolder(entry.label??key);populate(folder,entry.schema,[...path,key]);if(entry.collapsed)folder.close();continue}const editor=addEditor(group,backing,key,entry);if(entry.label)editor.name(entry.label);const full=[...path,key];editor.onChange(value=>{setValues(previous=>setIn(previous as Record<string,unknown>,full,value) as InspectorControlValues<S>);let node:InspectorControlSchema|undefined=schemaRef.current;for(let i=0;i<full.length-1&&node;i++)node=(node[full[i]] as InspectorFolder<any>)?.schema;(node?.[key] as InspectorControl<any>)?.onChange?.(value)})}}
    populate(root,schemaRef.current,[]);if(options.collapsed)root.close();parameters.show();return()=>{parameters.paramList.remove(root.paramList);const index=parameters.groups.indexOf(root);if(index!==-1)parameters.groups.splice(index,1)}
  },[controller,id,options.collapsed,options.title]);return values
}
