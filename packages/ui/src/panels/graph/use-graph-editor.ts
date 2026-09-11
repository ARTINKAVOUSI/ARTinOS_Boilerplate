import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canConnect, createNode, type GraphDefinition, type GraphEdge, type GraphGroup, type GraphNode, type GraphNodeType, type GraphRegistry } from '@artinos/graph'
import type { ArtinosRuntime } from '@artinos/runtime'
import { snap } from './geometry'

const HISTORY_LIMIT=60,PERSIST_MS=500,PASTE_OFFSET=28
const clone=(graph:GraphDefinition):GraphDefinition=>structuredClone(graph)
let clipboard:{nodes:GraphNode[];edges:GraphEdge[]}|null=null

export interface GraphEditor{
  graph:GraphDefinition
  /** Writes the definition into the registry immediately so evaluation stays live, then persists on a debounce. */
  apply(next:GraphDefinition,options?:{history?:boolean}):void
  update(mutate:(graph:GraphDefinition)=>GraphDefinition,options?:{history?:boolean}):void
  beginGesture():void
  endGesture():void
  undo():void
  redo():void
  canUndo:boolean
  canRedo:boolean
  addNode(type:GraphNodeType,x:number,y:number):GraphNode|undefined
  connect(from:string,output:string,to:string,input:string):string|undefined
  disconnect(edgeId:string):void
  removeNodes(ids:readonly string[]):void
  duplicate(ids:readonly string[]):string[]
  copy(ids:readonly string[]):void
  paste(x:number,y:number):string[]
  canPaste:boolean
  moveNodes(deltas:ReadonlyMap<string,{x:number;y:number}>,snapToGrid:boolean):void
  setField(nodeId:string,fieldId:string,value:unknown):void
  rename(nodeId:string,label:string):void
  group(ids:readonly string[],label?:string):string|undefined
  ungroup(groupId:string):void
  renameGroup(groupId:string,label:string):void
  toggleGroup(groupId:string):void
}

export function useGraphEditor(runtime:ArtinosRuntime,registry:GraphRegistry|undefined,source:GraphDefinition|undefined):GraphEditor{
  const [graph,setGraph]=useState<GraphDefinition>(()=>source?clone(source):{id:'',nodes:[],edges:[]})
  // Mutations read this rather than the render-time `graph`. Adding a node and
  // wiring it in the same tick would otherwise build the second edit from a
  // definition that does not contain the first one yet.
  const graphRef=useRef(graph)
  graphRef.current=graph
  const undoRef=useRef<GraphDefinition[]>([]),redoRef=useRef<GraphDefinition[]>([])
  const gestureRef=useRef<GraphDefinition|null>(null),writtenRef=useRef(''),timerRef=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [,bump]=useState(0)

  // Adopt the registry copy when the selection changes or something outside this panel edits it.
  useEffect(()=>{
    if(!source)return
    const incoming=JSON.stringify(source)
    if(source.id!==graph.id){undoRef.current=[];redoRef.current=[];writtenRef.current=incoming;setGraph(clone(source));return}
    if(incoming!==writtenRef.current){writtenRef.current=incoming;setGraph(clone(source))}
  },[source,graph.id])

  const persist=useCallback(()=>{
    if(!registry)return
    if(timerRef.current)clearTimeout(timerRef.current)
    timerRef.current=setTimeout(()=>{
      runtime.projectState.set('graphs',registry.list())
      runtime.persistence.save()
    },PERSIST_MS)
  },[registry,runtime])
  useEffect(()=>()=>{if(timerRef.current)clearTimeout(timerRef.current)},[])

  const apply=useCallback((next:GraphDefinition,options:{history?:boolean}={})=>{
    if(!registry)return
    if(options.history!==false&&!gestureRef.current){
      undoRef.current=[...undoRef.current,clone(graphRef.current)].slice(-HISTORY_LIMIT)
      redoRef.current=[]
    }
    graphRef.current=next
    writtenRef.current=JSON.stringify(next)
    registry.upsert(next)
    setGraph(next)
    persist()
  },[persist,registry])

  const update=useCallback((mutate:(graph:GraphDefinition)=>GraphDefinition,options?:{history?:boolean})=>apply(mutate(graphRef.current),options),[apply])

  const restore=useCallback((next:GraphDefinition)=>{
    if(!registry)return
    graphRef.current=next
    writtenRef.current=JSON.stringify(next)
    registry.upsert(next)
    setGraph(next)
    persist()
  },[persist,registry])

  const editor=useMemo<GraphEditor>(()=>({
    graph,
    apply,
    update,
    // A drag is one undo entry: snapshot on the first move, push once on release.
    beginGesture(){if(!gestureRef.current)gestureRef.current=clone(graphRef.current)},
    endGesture(){
      const baseline=gestureRef.current
      gestureRef.current=null
      if(!baseline||JSON.stringify(baseline)===JSON.stringify(graphRef.current))return
      undoRef.current=[...undoRef.current,baseline].slice(-HISTORY_LIMIT)
      redoRef.current=[]
      bump(value=>value+1)
    },
    undo(){
      const previous=undoRef.current.at(-1)
      if(!previous)return
      undoRef.current=undoRef.current.slice(0,-1)
      redoRef.current=[...redoRef.current,clone(graphRef.current)].slice(-HISTORY_LIMIT)
      restore(previous)
    },
    redo(){
      const next=redoRef.current.at(-1)
      if(!next)return
      redoRef.current=redoRef.current.slice(0,-1)
      undoRef.current=[...undoRef.current,clone(graphRef.current)].slice(-HISTORY_LIMIT)
      restore(next)
    },
    canUndo:undoRef.current.length>0,
    canRedo:redoRef.current.length>0,
    addNode(type,x,y){
      const node=createNode(type,snap(x),snap(y))
      apply({...graphRef.current,nodes:[...graphRef.current.nodes,node]})
      return node
    },
    connect(from,output,to,input){
      const fromNode=graphRef.current.nodes.find(node=>node.id===from),toNode=graphRef.current.nodes.find(node=>node.id===to)
      if(!fromNode||!toNode)return 'Node not found'
      const problem=canConnect(graphRef.current,fromNode,output,toNode,input)
      if(problem)return problem
      const order=graphRef.current.edges.filter(edge=>edge.to===to&&(edge.input??'value')===input).length
      apply({...graphRef.current,edges:[...graphRef.current.edges,{id:`edge-${Date.now().toString(36)}-${graphRef.current.edges.length}`,from,to,output,input,order}]})
      return undefined
    },
    disconnect(edgeId){apply({...graphRef.current,edges:graphRef.current.edges.filter(edge=>edge.id!==edgeId)})},
    removeNodes(ids){
      const set=new Set(ids)
      if(!set.size)return
      apply({...graphRef.current,nodes:graphRef.current.nodes.filter(node=>!set.has(node.id)),edges:graphRef.current.edges.filter(edge=>!set.has(edge.from)&&!set.has(edge.to))})
    },
    duplicate(ids){
      const set=new Set(ids),originals=graphRef.current.nodes.filter(node=>set.has(node.id))
      if(!originals.length)return []
      const remap=new Map(originals.map(node=>[node.id,{...createNode(node.type,(node.x??0)+PASTE_OFFSET,(node.y??0)+PASTE_OFFSET,{...node.data}),label:node.label}]))
      const copies=[...remap.values()]
      const edges=graphRef.current.edges.filter(edge=>set.has(edge.from)&&set.has(edge.to)).map((edge,index)=>({
        ...edge,id:`edge-${Date.now().toString(36)}-copy${index}`,
        from:remap.get(edge.from)?.id??edge.from,to:remap.get(edge.to)?.id??edge.to,
      }))
      apply({...graphRef.current,nodes:[...graphRef.current.nodes,...copies],edges:[...graphRef.current.edges,...edges]})
      return copies.map(node=>node.id)
    },
    copy(ids){
      const set=new Set(ids)
      const nodes=graphRef.current.nodes.filter(node=>set.has(node.id))
      clipboard=nodes.length?{nodes:structuredClone(nodes),edges:structuredClone(graphRef.current.edges.filter(edge=>set.has(edge.from)&&set.has(edge.to)))}:null
      bump(value=>value+1)
    },
    paste(x,y){
      if(!clipboard?.nodes.length)return []
      const left=Math.min(...clipboard.nodes.map(node=>node.x??0)),top=Math.min(...clipboard.nodes.map(node=>node.y??0))
      const remap=new Map(clipboard.nodes.map(node=>[node.id,createNode(node.type,snap(x+(node.x??0)-left),snap(y+(node.y??0)-top),{...node.data})]))
      const copies=clipboard.nodes.map(node=>({...remap.get(node.id) as GraphNode,label:node.label}))
      const edges=clipboard.edges.map((edge,index)=>({
        ...edge,id:`edge-${Date.now().toString(36)}-paste${index}`,
        from:remap.get(edge.from)?.id??edge.from,to:remap.get(edge.to)?.id??edge.to,
      }))
      apply({...graphRef.current,nodes:[...graphRef.current.nodes,...copies],edges:[...graphRef.current.edges,...edges]})
      return copies.map(node=>node.id)
    },
    canPaste:Boolean(clipboard?.nodes.length),
    moveNodes(deltas,snapToGrid){
      if(!deltas.size)return
      apply({...graphRef.current,nodes:graphRef.current.nodes.map(node=>{
        const delta=deltas.get(node.id)
        return delta?{...node,x:Math.max(0,snap((node.x??0)+delta.x,snapToGrid)),y:Math.max(0,snap((node.y??0)+delta.y,snapToGrid))}:node
      })},{history:false})
    },
    setField(nodeId,fieldId,value){
      apply({...graphRef.current,nodes:graphRef.current.nodes.map(node=>node.id===nodeId?{...node,data:{...(node.data??{}),[fieldId]:value}}:node)})
    },
    rename(nodeId,label){
      apply({...graphRef.current,nodes:graphRef.current.nodes.map(node=>node.id===nodeId?{...node,label:label||undefined}:node)})
    },
    group(ids,label){
      const members=[...new Set(ids)].filter(id=>graphRef.current.nodes.some(node=>node.id===id))
      if(members.length<2)return undefined
      const id=`group-${Date.now().toString(36)}`
      // A node belongs to one group, so grouping moves it out of any previous one.
      const groups=(graphRef.current.groups??[])
        .map(item=>({...item,nodes:item.nodes.filter(nodeId=>!members.includes(nodeId))}))
        .filter(item=>item.nodes.length>1)
      apply({...graphRef.current,groups:[...groups,{id,label:label??`Group ${groups.length+1}`,nodes:members}]})
      return id
    },
    ungroup(groupId){apply({...graphRef.current,groups:(graphRef.current.groups??[]).filter(group=>group.id!==groupId)})},
    renameGroup(groupId,label){
      apply({...graphRef.current,groups:(graphRef.current.groups??[]).map(group=>group.id===groupId?{...group,label}:group)})
    },
    toggleGroup(groupId){
      apply({...graphRef.current,groups:(graphRef.current.groups??[]).map(group=>group.id===groupId?{...group,collapsed:!group.collapsed}:group)})
    },
  // `graph` stays a dependency so the exposed `editor.graph` is always the current
  // definition; the mutators above deliberately read graphRef instead.
  }),[apply,graph,restore,update])

  return editor
}
