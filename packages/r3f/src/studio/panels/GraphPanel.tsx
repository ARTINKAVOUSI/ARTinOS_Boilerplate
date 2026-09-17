import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import {
  GRAPH_TEMPLATES, templatesForDomain, validateGraph,
  type GraphDefinition, type GraphDiagnostic, type GraphDomain, type GraphEngine, type GraphRegistry,
} from '@artinos/graph'
import { useArtinosRuntime, useResource, type PostFXController } from '@artinos/runtime'
import { workspacePortalTarget } from '@artinos/ui'
import { Badge, Button, FileField, IconButton, KeyValue, Section, Select, Stack, TextField, Toggle } from '@artinos/ui'
import { arrangeNodes, autoLayout, previewKind, type ArrangeMode } from './graph/geometry'
import { GraphCanvas, type Selection } from './graph/GraphCanvas'
import { GraphInspector } from './graph/GraphInspector'
import { emptySources, type FieldSources } from './graph/GraphFieldControl'
import type { NodePreviewService, PreviewFrame } from './graph/GraphNodePreview'
import { LiveGraphView } from './graph/LiveGraphView'
import { LiveInspector } from './graph/LiveInspector'
import type { LiveControl, LiveNode } from './graph/live-graph'
import { buildLiveGraph } from './graph/live-graph'
import { useGraphEditor } from './graph/use-graph-editor'

const DOMAINS:GraphDomain[]=['signal','parameter','scene','render','gpu']
const DOMAIN_HELP:Record<GraphDomain,string>={
  signal:'Evaluates numbers every frame and writes parameters or signals.',
  parameter:'The same evaluator as signal graphs, scoped to parameter authoring.',
  scene:'Writes transforms, visibility and material properties on named scene objects.',
  render:'Drives PostFX effects in the one shared render pipeline.',
  gpu:'Compiles to real TSL nodes published as a runtime resource.',
}
const EMPTY_SELECTION:Selection={nodes:new Set(),edges:new Set()}
const EMPTY_PREVIEWS=new Map<string,PreviewFrame>()

/**
 * Re-render on an interval so live node values stay readable without per-frame
 * React work. Returns the tick so value memos actually recompute: the graph
 * object does not change identity while it evaluates.
 */
function usePoll(intervalMs=100){
  const [tick,setTick]=useState(0)
  useEffect(()=>{const id=setInterval(()=>setTick(value=>value+1),intervalMs);return()=>clearInterval(id)},[intervalMs])
  return tick
}

export function GraphPanel(){
  const runtime=useArtinosRuntime()
  const registry=useResource<GraphRegistry>('graph.registry')
  const engine=useResource<GraphEngine>('graph.engine')
  const controller=useResource<PostFXController>('postfx.controller')
  const previewService=useResource<NodePreviewService>('node.preview')
  // Typed structurally so @artinos/ui stays free of a direct three dependency.
  const scene=useResource<{traverse(visit:(object:{name?:string})=>void):void}>('three.scene')
  useSyncExternalStore(registry?registry.subscribe.bind(registry):()=>()=>{},()=>registry?.revision??0,()=>0)
  useSyncExternalStore(
    previewService?previewService.subscribe.bind(previewService):()=>()=>{},
    ()=>previewService?.revision??0,()=>0)
  const tick=usePoll(120)

  const graphs=useMemo(()=>registry?.list()??[],[registry,registry?.revision])
  const [selectedId,setSelectedId]=useState('')
  const [selection,setSelection]=useState<Selection>(EMPTY_SELECTION)
  const [collapsed,setCollapsed]=useState<ReadonlySet<string>>(()=>new Set())
  const [notice,setNotice]=useState('')
  const [snapToGrid,setSnapToGrid]=useState(true)
  const [overlay,setOverlay]=useState<'inspector'|'graph'|null>('inspector')
  const [maximized,setMaximized]=useState(false)
  // The live view is the default: it shows what is actually running, not what was authored.
  const [mode,setMode]=useState<'live'|'edit'>('live')
  const [liveSelection,setLiveSelection]=useState<LiveNode|null>(null)

  const source=graphs.find(graph=>graph.id===selectedId)??graphs[0]
  const editor=useGraphEditor(runtime,registry,source)
  const graph=editor.graph
  const domain=graph.domain??'signal'

  useEffect(()=>{if(source&&source.id!==selectedId)setSelectedId(source.id)},[source,selectedId])
  useEffect(()=>{setSelection(EMPTY_SELECTION);setCollapsed(new Set())},[selectedId])
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),2600);return()=>clearTimeout(id)},[notice])
  useEffect(()=>{
    if(!maximized)return
    const leave=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('.artinos-gpalette'))setMaximized(false)}
    window.addEventListener('keydown',leave)
    return()=>window.removeEventListener('keydown',leave)
  },[maximized])

  const sources=useMemo<FieldSources>(()=>{
    if(!controller&&!scene)return emptySources
    const effects=controller?.snapshot()??[]
    const objects:string[]=[]
    scene?.traverse(object=>{if(object.name)objects.push(object.name)})
    return {
      signals:runtime.signals.list().map(sample=>sample.id).sort(),
      parameters:runtime.parameters.list().map(state=>state.definition.id).sort(),
      effects:effects.map(effect=>effect.id),
      effectParameters:Object.fromEntries(effects.map(effect=>[effect.id,Object.keys(effect.params??{})])),
      objects:[...new Set(objects)].sort(),
    }
  // The registry revision is a cheap proxy for "the panel is re-rendering anyway".
  },[controller,runtime,scene,registry?.revision])

  const values=useMemo(()=>{
    const map=new Map<string,unknown>()
    if(engine)for(const node of graph.nodes)map.set(node.id,engine.last(graph.id,node.id))
    return map
  },[engine,graph,tick])

  const liveGraph=useMemo(
    ()=>mode==='live'?buildLiveGraph(runtime,scene,controller?.snapshot()??[],graphs):null,
  // Rebuilt on the poll tick so values, scene contents and the effect chain stay current.
  [mode,runtime,scene,controller,graphs,tick])

  // Falls back to the last known node: disabling an effect drops it out of the
  // live chain, and the inspector must survive that so it can be switched back on.
  const liveSelected=useMemo(
    ()=>liveSelection?liveGraph?.nodes.find(node=>node.id===liveSelection.id)??liveSelection:null,
    [liveGraph,liveSelection])

  const liveGraphKey=useMemo(
    ()=>(liveGraph?.nodes??[]).filter(node=>node.resourceId).map(node=>`${node.id}:${node.resourceId}`).join(','),
    [liveGraph])

  // Only nodes that actually show a thumbnail are queued for GPU capture, and
  // only for the mode currently on screen.
  useEffect(()=>{
    if(!previewService)return
    const keys:string[]=[]
    if(mode==='edit'){
      for(const node of graph.nodes){
        if(previewKind(node,domain)!=='render'||collapsed.has(node.id))continue
        previewService.request(node.id,engine?.last(graph.id,node.id))
        keys.push(node.id)
      }
    }else{
      for(const node of liveGraph?.nodes??[]){
        if(!node.resourceId)continue
        const resource=runtime.resources.get(node.resourceId)
        if(!resource)continue
        previewService.request(node.id,resource)
        keys.push(node.id)
      }
    }
    return()=>{for(const key of keys)previewService.release(key)}
  // liveGraph is rebuilt every tick but its node identity set is what matters here.
  },[previewService,engine,graph,domain,collapsed,mode,runtime,liveGraphKey])

  const previews=useMemo(()=>{
    if(!previewService)return EMPTY_PREVIEWS
    const map=new Map<string,PreviewFrame>()
    const ids=mode==='edit'?graph.nodes.map(node=>node.id):(liveGraph?.nodes??[]).filter(node=>node.resourceId).map(node=>node.id)
    for(const id of ids){
      const frame=previewService.get(id)
      if(frame)map.set(id,frame)
    }
    return map
  },[previewService,previewService?.revision,graph.nodes,mode,liveGraphKey])

  const diagnostics=useMemo<GraphDiagnostic[]>(()=>{
    const structural=validateGraph(graph)
    const runtimeIssues=engine?.diagnostics(graph.id)??[]
    const seen=new Set<string>()
    return [...structural,...runtimeIssues].filter(item=>{
      const key=`${item.severity}:${item.nodeId??item.edgeId??''}:${item.message}`
      if(seen.has(key))return false
      seen.add(key)
      return true
    })
  },[engine,graph])

  const persistAll=useCallback(()=>{
    if(!registry)return
    runtime.projectState.set('graphs',registry.list())
    runtime.persistence.save()
  },[registry,runtime])

  const createGraph=useCallback((templateId:string)=>{
    if(!registry)return
    const template=GRAPH_TEMPLATES.find(item=>item.id===templateId)??GRAPH_TEMPLATES[0]
    const id=`graph-${Date.now().toString(36)}`
    registry.upsert(template.build(id))
    persistAll()
    setSelectedId(id)
    setNotice(`Created ${template.name}`)
  },[persistAll,registry])

  /** Routes a control on a live node to the thing that node stands for. */
  const applyLiveControl=useCallback((node:LiveNode,control:LiveControl,value:number|boolean)=>{
    const target=node.target
    if(!target)return
    // A registered parameter is the owner wherever one exists: PostFX effects are
    // rendered from `postfx.*` parameters, so writing the controller instead is
    // reverted the moment that tree re-renders.
    if(control.kind!=='readout'&&control.parameterId){
      runtime.setParameter(control.parameterId,value,`Set ${control.label}`)
      return
    }
    if(target.kind==='parameter'){
      runtime.setParameter(target.id,value,`Set ${node.title}`)
      return
    }
    if(target.kind==='effect'&&controller){
      const effect=controller.snapshot().find(item=>item.id===target.id)
      if(effect)controller.update(target.id,{params:{...effect.params,[control.id]:value}})
      return
    }
    if(target.kind==='object'){
      const object=target.object as Record<string,unknown>
      object[control.id]=value
      return
    }
    if(target.kind==='binding'){
      const binding=runtime.bindings.list().find(item=>item.id===target.id)
      if(!binding)return
      // The engine keys bindings by id, so re-adding with a patch replaces it.
      runtime.bindings.add({...binding,[control.id]:value})
      return
    }
    if(target.kind==='graph'&&control.id==='enabled'&&registry){
      const definition=registry.get(target.id)
      if(!definition)return
      registry.upsert({...definition,enabled:Boolean(value)})
      persistAll()
    }
  },[controller,persistAll,registry,runtime])

  const toggleCollapse=useCallback((nodeId:string)=>setCollapsed(current=>{
    const next=new Set(current)
    next.has(nodeId)?next.delete(nodeId):next.add(nodeId)
    return next
  }),[])

  if(!registry)return <Section title="Graphs" description="The graph runtime installs with the project.">
    <KeyValue label="Status" value="Waiting for the project runtime"/>
  </Section>

  if(!graphs.length&&mode==='edit')return <div className="artinos-graph-studio is-empty">
    <Section title="Graph Studio" description="Node graphs drive parameters, signals, scene objects, PostFX and TSL from one editor.">
      <Stack>{GRAPH_TEMPLATES.map(template=><div key={template.id} className="artinos-gtemplate">
        <div><b>{template.name}</b><small>{template.description}</small></div>
        <Button onClick={()=>createGraph(template.id)}>Create</Button>
      </div>)}</Stack>
    </Section>
  </div>

  const errors=diagnostics.filter(item=>item.severity==='error').length
  const warnings=diagnostics.length-errors
  const evalMs=Number(runtime.telemetry.get(`graph.${graph.id}.ms`)?.value??0)

  const studio=<div className={`artinos-graph-studio ${maximized?'is-maximized':''}`}>
    <div className="artinos-graph-bar">
      <div className="artinos-lmode" role="tablist" aria-label="Graph mode">
        <button role="tab" aria-selected={mode==='live'} className={mode==='live'?'is-active':''} onClick={()=>setMode('live')} title="What is running right now">Live</button>
        <button role="tab" aria-selected={mode==='edit'} className={mode==='edit'?'is-active':''} onClick={()=>setMode('edit')} title="Author node graphs">Edit</button>
      </div>
      {mode==='edit'&&<Select label="" value={graph.id} options={graphs.map(item=>({label:`${item.name??item.id}${item.enabled===false?' · off':''}`,value:item.id}))} onChange={setSelectedId}/>}
      {mode==='edit'
        ?<><Badge tone={graph.enabled===false?'neutral':errors?'danger':'accent'}>{graph.enabled===false?'paused':errors?`${errors} error${errors>1?'s':''}`:'live'}</Badge>
          <span className="artinos-graph-meta">{graph.nodes.length}n · {graph.edges.length}w · {evalMs.toFixed(2)}ms</span></>
        :<span className="artinos-graph-meta">{liveGraph?.nodes.length??0} nodes · {liveGraph?.edges.length??0} links · reading the live runtime</span>}
      <div className="artinos-graph-bar-actions">
        {mode==='live'&&<IconButton title="Inspector" active={overlay==='inspector'} onClick={()=>setOverlay(value=>value==='inspector'?null:'inspector')}>◧</IconButton>}
        {mode==='edit'&&<>
          <IconButton title={graph.enabled===false?'Resume evaluation':'Pause evaluation'} active={graph.enabled!==false} onClick={()=>editor.apply({...graph,enabled:graph.enabled===false})}>{graph.enabled===false?'▶':'❙❙'}</IconButton>
          <IconButton title="Undo (Ctrl+Z)" onClick={editor.undo}>↶</IconButton>
          <IconButton title="Redo (Ctrl+Shift+Z)" onClick={editor.redo}>↷</IconButton>
          <IconButton title="Arrange by dependency depth" onClick={()=>editor.apply({...graph,nodes:autoLayout(graph)})}>⌗</IconButton>
          <Select label="" value="" options={[{label:'Arrange…',value:''},
            {label:'Align left',value:'align-left'},{label:'Align right',value:'align-right'},
            {label:'Align top',value:'align-top'},{label:'Align bottom',value:'align-bottom'},
            {label:'Distribute across',value:'distribute-h'},{label:'Distribute down',value:'distribute-v'},
            {label:'Lay out in a row',value:'row'},{label:'Lay out in a column',value:'column'}]}
            onChange={next=>{
              if(!next)return
              if(selection.nodes.size<2){setNotice('Select at least two nodes to arrange');return}
              editor.apply({...graph,nodes:arrangeNodes(graph,[...selection.nodes],next as ArrangeMode)})
            }}/>
          <IconButton title="Group the selected nodes into a subgraph" onClick={()=>{
            const id=editor.group([...selection.nodes])
            setNotice(id?'Grouped':'Select at least two nodes to group')
          }}>▣</IconButton>
          <IconButton title="Ungroup the selection" onClick={()=>{
            const owning=(graph.groups??[]).filter(group=>group.nodes.some(nodeId=>selection.nodes.has(nodeId)))
            if(!owning.length){setNotice('The selection is not in a group');return}
            for(const group of owning)editor.ungroup(group.id)
            setNotice('Ungrouped')
          }}>▢</IconButton>
          <IconButton title="Snap to grid" active={snapToGrid} onClick={()=>setSnapToGrid(value=>!value)}>⊞</IconButton>
          <IconButton title="Node inspector" active={overlay==='inspector'} onClick={()=>setOverlay(value=>value==='inspector'?null:'inspector')}>◧</IconButton>
          <IconButton title="Graph settings, templates and import/export" active={overlay==='graph'} onClick={()=>setOverlay(value=>value==='graph'?null:'graph')}>⚙</IconButton>
        </>}
        <IconButton title={maximized?'Exit full window (Esc)':'Edit in the full window'} active={maximized} onClick={()=>setMaximized(value=>!value)}>{maximized?'⤡':'⤢'}</IconButton>
      </div>
    </div>

    <div className="artinos-graph-stage">
      {mode==='live'&&liveGraph&&<LiveGraphView graph={liveGraph} previews={previews} onInspect={node=>{setLiveSelection(node);setOverlay('inspector')}} onControl={applyLiveControl} insetRight={overlay?280:0}/>}
      {mode==='edit'&&<GraphCanvas
        editor={editor} selection={selection} onSelection={setSelection}
        values={values} diagnostics={diagnostics} sources={sources}
        snapToGrid={snapToGrid} collapsed={collapsed} onToggleCollapse={toggleCollapse}
        previews={previews} onNotice={setNotice}/>}

      {overlay&&<aside className="artinos-graph-overlay">
        <header>
          <b>{overlay==='inspector'?(mode==='live'?'Live':'Node'):'Graph'}</b>
          <button type="button" title="Close" onClick={()=>setOverlay(null)}>×</button>
        </header>
        <div className="artinos-graph-overlay-body">
          {overlay==='graph'&&mode==='edit'
            ?<GraphLibrary graph={graph} graphs={graphs} registry={registry} editor={editor} onSelect={setSelectedId} onCreate={createGraph} onPersist={persistAll} onNotice={setNotice}/>
            :mode==='live'
              ?<LiveInspector node={liveSelected} runtime={runtime} controller={controller??undefined}
                  onOpenGraph={id=>{setSelectedId(id);setMode('edit')}}/>
              :<GraphInspector editor={editor} selected={[...selection.nodes]} values={values} diagnostics={diagnostics} sources={sources}/>}
        </div>
      </aside>}

      {mode==='edit'&&Boolean(diagnostics.length)&&<div className="artinos-graph-issues">
        <details>
          <summary><Badge tone={errors?'danger':'warn'}>{errors?`${errors} error${errors>1?'s':''}`:`${warnings} warning${warnings>1?'s':''}`}</Badge></summary>
          <Stack>{diagnostics.map((item,index)=><button
            key={`${item.message}-${index}`} type="button" className={`artinos-gdiagnostic is-${item.severity}`}
            onClick={()=>item.nodeId&&setSelection({nodes:new Set([item.nodeId]),edges:new Set()})}>
            <Badge tone={item.severity==='error'?'danger':'warn'}>{item.severity}</Badge><span>{item.message}</span>
          </button>)}</Stack>
        </details>
      </div>}

      {notice&&<div className="artinos-gnotice">{notice}</div>}
      <p className="artinos-graph-hint">{mode==='live'?'Generated from the running runtime: live signals, the logic consuming them, the parameters they drive, the objects in the viewport and the render pipeline.':DOMAIN_HELP[domain]}</p>
    </div>
  </div>

  // Portalled rather than position:fixed: the panel's backdrop-filter makes it a
  // containing block, which would trap a fixed element inside the dock. Portals
  // into .plate-workspace, not <body> — data-theme lives there, and anything
  // outside that scope falls back to dark tokens regardless of the active theme.
  return maximized?createPortal(<div className="artinos-graph-fullscreen">{studio}</div>,workspacePortalTarget()):studio
}

function GraphLibrary({graph,graphs,registry,editor,onSelect,onCreate,onPersist,onNotice}:{
  graph:GraphDefinition
  graphs:readonly GraphDefinition[]
  registry:GraphRegistry
  editor:ReturnType<typeof useGraphEditor>
  onSelect(id:string):void
  onCreate(templateId:string):void
  onPersist():void
  onNotice(message:string):void
}){
  const [template,setTemplate]=useState('blank')
  const domain=graph.domain??'signal'
  return <>
    <Section title="Definition">
      <TextField label="Name" value={graph.name??''} placeholder={graph.id} onChange={name=>editor.apply({...graph,name:name||undefined})}/>
      <Select label="Domain" value={domain} options={DOMAINS.map(value=>({label:value,value}))}
        onChange={next=>{
          const invalid=validateGraph({...graph,domain:next as GraphDomain}).filter(item=>item.severity==='error')
          editor.apply({...graph,domain:next as GraphDomain})
          if(invalid.length)onNotice(`${invalid.length} node${invalid.length>1?'s are':' is'} not available in the ${next} domain`)
        }}/>
      <Toggle label="Evaluate every frame" value={graph.enabled!==false} onChange={enabled=>editor.apply({...graph,enabled})}/>
    </Section>
    <Section title="New graph">
      <Select label="Template" value={template} options={templatesForDomain(domain).map(item=>({label:item.name,value:item.id}))} onChange={setTemplate}/>
      <Button onClick={()=>onCreate(template)}>Create</Button>
    </Section>
    <Section title="Portability">
      <div className="artinos-button-row">
        <Button onClick={()=>{
          const id=`graph-${Date.now().toString(36)}`
          registry.upsert({...structuredClone(graph),id,name:`${graph.name??graph.id} copy`})
          onPersist();onSelect(id);onNotice('Duplicated graph')
        }}>Duplicate</Button>
        <Button onClick={()=>{
          navigator.clipboard?.writeText(JSON.stringify(graph,null,2))
          onNotice('Graph JSON copied')
        }}>Copy JSON</Button>
        {graphs.length>1&&<Button onClick={()=>{
          registry.remove(graph.id)
          onPersist()
          onSelect(registry.list()[0]?.id??'')
          onNotice('Graph deleted')
        }}>Delete</Button>}
      </div>
      <FileField label="Import JSON" accept="application/json,.json" onFiles={async files=>{
        const file=files[0]
        if(!file)return
        try{
          const parsed=JSON.parse(await file.text()) as GraphDefinition
          if(!Array.isArray(parsed?.nodes)||!Array.isArray(parsed?.edges))throw new Error('Not a graph definition')
          const id=registry.has(parsed.id)?`graph-${Date.now().toString(36)}`:parsed.id
          registry.upsert({...parsed,id})
          onPersist();onSelect(id);onNotice(`Imported ${parsed.name??id}`)
        }catch(error){onNotice(`Import failed: ${error instanceof Error?error.message:'invalid JSON'}`)}
      }}/>
    </Section>
  </>
}
