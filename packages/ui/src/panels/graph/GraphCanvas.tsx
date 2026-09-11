import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { canConnect, inputsOf, outputsOf, type GraphDiagnostic, type GraphNode, type GraphNodeType, type GraphValueType } from '@artinos/graph'
import { GROUP_COLLAPSED_H, GROUP_HEADER, NODE_WIDTH, anchor, graphBounds, groupBounds, nodeHeight, wireMidpoint, wirePath, type Point, type PortSide } from './geometry'
import type { PreviewFrame } from './GraphNodePreview'
import { GraphNodeView } from './GraphNodeView'
import { GraphPalette, type PaletteRequest } from './GraphPalette'
import type { FieldSources } from './GraphFieldControl'
import type { GraphEditor } from './use-graph-editor'

export interface Selection{nodes:ReadonlySet<string>;edges:ReadonlySet<string>}
interface Viewport{x:number;y:number;zoom:number}
interface Linking{from:{nodeId:string;portId:string;side:PortSide;type:GraphValueType};pointer:Point}
interface Marquee{origin:Point;pointer:Point}

const MIN_ZOOM=.3,MAX_ZOOM=2.2,FIT_MIN_ZOOM=.55

export function GraphCanvas({editor,selection,onSelection,values,diagnostics,sources,snapToGrid,collapsed,onToggleCollapse,previews,onNotice}:{
  editor:GraphEditor
  selection:Selection
  onSelection(next:Selection):void
  values:ReadonlyMap<string,unknown>
  diagnostics:readonly GraphDiagnostic[]
  sources:FieldSources
  snapToGrid:boolean
  collapsed:ReadonlySet<string>
  onToggleCollapse(nodeId:string):void
  previews:ReadonlyMap<string,PreviewFrame>
  onNotice(message:string):void
}){
  const {graph}=editor
  const surfaceRef=useRef<HTMLDivElement>(null)
  const [viewport,setViewport]=useState<Viewport>({x:0,y:0,zoom:1})
  const [linking,setLinking]=useState<Linking|null>(null)
  const [marquee,setMarquee]=useState<Marquee|null>(null)
  const [palette,setPalette]=useState<PaletteRequest|null>(null)
  const [hoverEdge,setHoverEdge]=useState<string|null>(null)
  const pointerRef=useRef<Point>({x:0,y:0})

  const byId=useMemo(()=>new Map(graph.nodes.map(node=>[node.id,node])),[graph.nodes])
  const severity=useMemo(()=>{
    const map=new Map<string,'error'|'warning'>()
    for(const item of diagnostics)if(item.nodeId&&(item.severity==='error'||map.get(item.nodeId)!=='error'))map.set(item.nodeId,item.severity)
    return map
  },[diagnostics])
  const connectedInputs=useMemo(()=>{
    const map=new Map<string,Set<string>>()
    for(const edge of graph.edges){
      const set=map.get(edge.to)??new Set<string>()
      set.add(edge.input??'value')
      map.set(edge.to,set)
    }
    return map
  },[graph.edges])
  const emptySet=useMemo(()=>new Set<string>(),[])
  const collapsedRef=useRef(collapsed)
  collapsedRef.current=collapsed
  /** Members of a folded group are represented by the group box instead of drawn. */
  const folded=useMemo(()=>{
    const map=new Map<string,{id:string;x:number;y:number}>()
    for(const group of graph.groups??[]){
      if(!group.collapsed)continue
      const members=graph.nodes.filter(node=>group.nodes.includes(node.id))
      if(!members.length)continue
      const x=Math.min(...members.map(node=>node.x??0)),y=Math.min(...members.map(node=>node.y??0))
      for(const node of members)map.set(node.id,{id:group.id,x,y})
    }
    return map
  },[graph.groups,graph.nodes])
  /** Where a wire attaches when its node is hidden inside a folded group. */
  const stand=useCallback((node:GraphNode,side:PortSide,portId:string):Point=>{
    const box=folded.get(node.id)
    if(!box)return anchor(node,side,portId,collapsedRef.current.has(node.id))
    return {x:box.x+(side==='out'?NODE_WIDTH:0),y:box.y+GROUP_COLLAPSED_H/2}
  },[folded])

  // GraphNodeView is memoized on data only, so its handler props must be stable
  // identities. They read live state through this ref instead of a render closure;
  // without it a node keeps whichever `linking`/`graph` existed when it last drew.
  const live=useRef({graph,editor,selection,viewport,linking,snapToGrid,onSelection,onNotice,onToggleCollapse})
  live.current={graph,editor,selection,viewport,linking,snapToGrid,onSelection,onNotice,onToggleCollapse}

  /** Screen pixels to graph units. */
  const toGraph=useCallback((clientX:number,clientY:number):Point=>{
    const rect=surfaceRef.current?.getBoundingClientRect()
    if(!rect)return {x:0,y:0}
    const view=live.current.viewport
    return {x:(clientX-rect.left-view.x)/view.zoom,y:(clientY-rect.top-view.y)/view.zoom}
  },[])

  const fit=useCallback(()=>{
    const rect=surfaceRef.current?.getBoundingClientRect()
    if(!rect||!graph.nodes.length){setViewport({x:0,y:0,zoom:1});return}
    const bounds=graphBounds(graph,collapsedRef.current),margin=40
    // Auto-fit stops at a readable zoom instead of shrinking a wide graph to
    // illegible specks; below this the user pans rather than squints.
    const zoom=Math.max(FIT_MIN_ZOOM,Math.min(1,Math.min((rect.width-margin*2)/bounds.width,(rect.height-margin*2)/bounds.height)))
    setViewport({zoom,x:rect.width/2-(bounds.x+bounds.width/2)*zoom,y:rect.height/2-(bounds.y+bounds.height/2)*zoom})
  },[graph])
  // Frame a graph when it is first shown and whenever the selection changes graph.
  // `fit` is deliberately not a dependency: refitting on every edit would fight the user.
  const fitRef=useRef(fit)
  fitRef.current=fit
  useEffect(()=>{const id=window.setTimeout(()=>fitRef.current());return()=>window.clearTimeout(id)},[graph.id])

  const zoomBy=useCallback((factor:number,origin?:Point)=>setViewport(current=>{
    const rect=surfaceRef.current?.getBoundingClientRect()
    const pivot=origin??(rect?{x:rect.width/2,y:rect.height/2}:{x:0,y:0})
    const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*factor))
    const scale=zoom/current.zoom
    return {zoom,x:pivot.x-(pivot.x-current.x)*scale,y:pivot.y-(pivot.y-current.y)*scale}
  }),[])

  useEffect(()=>{
    const surface=surfaceRef.current
    if(!surface)return
    const onWheel=(event:WheelEvent)=>{
      event.preventDefault()
      const rect=surface.getBoundingClientRect()
      zoomBy(event.deltaY<0?1.12:1/1.12,{x:event.clientX-rect.left,y:event.clientY-rect.top})
    }
    surface.addEventListener('wheel',onWheel,{passive:false})
    return()=>surface.removeEventListener('wheel',onWheel)
  },[zoomBy])

  // ── Interaction ────────────────────────────────────────────────────────────
  const startPan=(event:ReactPointerEvent)=>{
    const startX=event.clientX,startY=event.clientY,origin={...viewport}
    const move=(moveEvent:PointerEvent)=>setViewport({...origin,x:origin.x+moveEvent.clientX-startX,y:origin.y+moveEvent.clientY-startY})
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }

  const startNodeDrag=useCallback((event:ReactPointerEvent,node:GraphNode)=>{
    if((event.target as HTMLElement).closest('input,select,textarea,button.artinos-gport'))return
    if(event.button!==0)return
    event.stopPropagation()
    const current=live.current
    // Shift/meta toggles membership without starting a drag; a plain click on an
    // unselected node replaces the selection, and on a selected one keeps the group.
    if(event.shiftKey||event.metaKey||event.ctrlKey){
      const nodes=new Set(current.selection.nodes)
      nodes.has(node.id)?nodes.delete(node.id):nodes.add(node.id)
      current.onSelection({nodes,edges:current.selection.edges})
      return
    }
    const moving=current.selection.nodes.has(node.id)?[...current.selection.nodes]:[node.id]
    if(!current.selection.nodes.has(node.id))current.onSelection({nodes:new Set([node.id]),edges:new Set<string>()})
    const startX=event.clientX,startY=event.clientY
    let last={x:0,y:0},dragged=false
    const move=(moveEvent:PointerEvent)=>{
      const zoom=live.current.viewport.zoom
      const dx=(moveEvent.clientX-startX)/zoom,dy=(moveEvent.clientY-startY)/zoom
      if(!dragged&&Math.hypot(dx,dy)<2)return
      if(!dragged){dragged=true;live.current.editor.beginGesture()}
      const deltas=new Map(moving.map(id=>[id,{x:dx-last.x,y:dy-last.y}]))
      last={x:dx,y:dy}
      live.current.editor.moveNodes(deltas,false)
    }
    const up=()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      if(!dragged)return
      if(live.current.snapToGrid)live.current.editor.moveNodes(new Map(moving.map(id=>[id,{x:0,y:0}])),true)
      live.current.editor.endGesture()
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  },[])

  const startLink=useCallback((event:ReactPointerEvent,node:GraphNode,side:PortSide,portId:string)=>{
    if(event.button!==0)return
    event.stopPropagation()
    const current=live.current.graph,api=live.current.editor
    const ports=side==='out'?outputsOf(node):inputsOf(node)
    const type=ports.find(port=>port.id===portId)?.type??'any'
    // Dragging off a connected input detaches that wire so it can be re-routed.
    if(side==='in'){
      const existing=current.edges.find(edge=>edge.to===node.id&&(edge.input??'value')===portId)
      if(existing?.id){
        const origin=current.nodes.find(item=>item.id===existing.from)
        api.disconnect(existing.id)
        if(origin){
          setLinking({from:{nodeId:origin.id,portId:existing.output??'value',side:'out',type},pointer:toGraph(event.clientX,event.clientY)})
          return
        }
      }
    }
    setLinking({from:{nodeId:node.id,portId,side,type},pointer:toGraph(event.clientX,event.clientY)})
  },[toGraph])

  const finishLink=useCallback((_event:ReactPointerEvent,node:GraphNode,side:PortSide,portId:string)=>{
    const active=live.current.linking,current=live.current.graph,api=live.current.editor,notify=live.current.onNotice
    if(!active)return
    const from=active.from
    setLinking(null)
    if(from.side===side){notify('Connect an output to an input');return}
    const source=from.side==='out'?from.nodeId:node.id
    const sourcePort=from.side==='out'?from.portId:portId
    const target=from.side==='out'?node.id:from.nodeId
    const targetPort=from.side==='out'?portId:from.portId
    const sourceNode=current.nodes.find(item=>item.id===source),targetNode=current.nodes.find(item=>item.id===target)
    if(!sourceNode||!targetNode)return
    const problem=canConnect(current,sourceNode,sourcePort,targetNode,targetPort)
    if(problem){notify(problem);return}
    const failure=api.connect(source,sourcePort,target,targetPort)
    if(failure)notify(failure)
  },[])

  const setField=useCallback((node:GraphNode,fieldId:string,value:unknown)=>live.current.editor.setField(node.id,fieldId,value),[])
  const toggleCollapse=useCallback((node:GraphNode)=>live.current.onToggleCollapse(node.id),[])

  useEffect(()=>{
    if(!linking)return
    const move=(event:PointerEvent)=>{
      pointerRef.current=toGraph(event.clientX,event.clientY)
      setLinking(current=>current?{...current,pointer:pointerRef.current}:current)
    }
    // Releasing over empty space offers a compatible node instead of silently cancelling.
    const up=(event:PointerEvent)=>{
      const target=event.target instanceof Element?event.target.closest('.artinos-gport'):null
      if(target)return
      const rect=surfaceRef.current?.getBoundingClientRect()
      const inside=rect&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom
      const point=toGraph(event.clientX,event.clientY)
      if(inside&&rect)setPalette({x:point.x,y:point.y,screenX:event.clientX-rect.left,screenY:event.clientY-rect.top,link:linking.from})
      else setLinking(null)
    }
    window.addEventListener('pointermove',move)
    window.addEventListener('pointerup',up)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
  },[linking,toGraph])

  const startMarquee=(event:ReactPointerEvent)=>{
    if(event.button===1||event.button===2||event.altKey){startPan(event);return}
    if(event.button!==0)return
    const origin=toGraph(event.clientX,event.clientY)
    const additive=event.shiftKey
    setMarquee({origin,pointer:origin})
    const move=(moveEvent:PointerEvent)=>setMarquee(current=>current?{...current,pointer:toGraph(moveEvent.clientX,moveEvent.clientY)}:current)
    const up=(upEvent:PointerEvent)=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      const end=toGraph(upEvent.clientX,upEvent.clientY)
      setMarquee(null)
      const left=Math.min(origin.x,end.x),right=Math.max(origin.x,end.x),top=Math.min(origin.y,end.y),bottom=Math.max(origin.y,end.y)
      if(right-left<4&&bottom-top<4){if(!additive)onSelection({nodes:emptySet,edges:emptySet});return}
      const domain=graph.domain??'signal'
      const hit=graph.nodes.filter(node=>(node.x??0)<right&&(node.x??0)+NODE_WIDTH>left&&(node.y??0)<bottom&&(node.y??0)+nodeHeight(node,domain,collapsed.has(node.id))>top).map(node=>node.id)
      onSelection({nodes:new Set(additive?[...selection.nodes,...hit]:hit),edges:emptySet})
    }
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }

  const openPalette=(clientX:number,clientY:number)=>{
    const rect=surfaceRef.current?.getBoundingClientRect()
    if(!rect)return
    const point=toGraph(clientX,clientY)
    setPalette({x:point.x,y:point.y,screenX:clientX-rect.left,screenY:clientY-rect.top})
  }

  const pick=(type:GraphNodeType)=>{
    const request=palette
    setPalette(null)
    setLinking(null)
    if(!request)return
    const node=editor.addNode(type,request.x,request.y)
    if(!node)return
    if(request.link){
      const created={...node},link=request.link
      const port=link.side==='out'?inputsOf(created)[0]:outputsOf(created)[0]
      if(port){
        const problem=link.side==='out'
          ?editor.connect(link.nodeId,link.portId,created.id,port.id)
          :editor.connect(created.id,port.id,link.nodeId,link.portId)
        if(problem)onNotice(problem)
      }
    }
    onSelection({nodes:new Set([node.id]),edges:emptySet})
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const onKeyDown=(event:ReactKeyboardEvent)=>{
    if((event.target as HTMLElement).closest('input,select,textarea'))return
    const meta=event.metaKey||event.ctrlKey
    if(event.key==='Delete'||event.key==='Backspace'){
      event.preventDefault()
      if(selection.edges.size)for(const id of selection.edges)editor.disconnect(id)
      if(selection.nodes.size)editor.removeNodes([...selection.nodes])
      onSelection({nodes:emptySet,edges:emptySet})
    }else if(meta&&event.key.toLowerCase()==='z'){
      event.preventDefault()
      event.shiftKey?editor.redo():editor.undo()
    }else if(meta&&event.key.toLowerCase()==='y'){event.preventDefault();editor.redo()}
    else if(meta&&event.key.toLowerCase()==='d'){event.preventDefault();onSelection({nodes:new Set(editor.duplicate([...selection.nodes])),edges:emptySet})}
    else if(meta&&event.key.toLowerCase()==='c'){editor.copy([...selection.nodes])}
    else if(meta&&event.key.toLowerCase()==='v'){
      event.preventDefault()
      const point=pointerRef.current
      onSelection({nodes:new Set(editor.paste(point.x||60,point.y||60)),edges:emptySet})
    }
    else if(meta&&event.key.toLowerCase()==='a'){event.preventDefault();onSelection({nodes:new Set(graph.nodes.map(node=>node.id)),edges:emptySet})}
    else if(event.key.toLowerCase()==='f'){event.preventDefault();fit()}
    else if(event.key==='Escape'){setLinking(null);setPalette(null);onSelection({nodes:emptySet,edges:emptySet})}
  }

  const marqueeRect=marquee&&{
    left:Math.min(marquee.origin.x,marquee.pointer.x),top:Math.min(marquee.origin.y,marquee.pointer.y),
    width:Math.abs(marquee.pointer.x-marquee.origin.x),height:Math.abs(marquee.pointer.y-marquee.origin.y),
  }
  const linkStart=linking&&byId.get(linking.from.nodeId)
  const bounds=graphBounds(graph,collapsed)

  return <div
    ref={surfaceRef} className={`artinos-gcanvas ${linking?'is-linking':''}`} tabIndex={0}
    onKeyDown={onKeyDown}
    onPointerDown={startMarquee}
    onDoubleClick={event=>{if((event.target as HTMLElement).closest('.artinos-gnode'))return;openPalette(event.clientX,event.clientY)}}
    onContextMenu={event=>{event.preventDefault();openPalette(event.clientX,event.clientY)}}
    onPointerMove={event=>{pointerRef.current=toGraph(event.clientX,event.clientY)}}>

    <div className="artinos-gviewport" style={{transform:`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`}}>
      <svg className="artinos-gwires" style={{left:bounds.x-2000,top:bounds.y-2000,width:bounds.width+4000,height:bounds.height+4000}}
        viewBox={`${bounds.x-2000} ${bounds.y-2000} ${bounds.width+4000} ${bounds.height+4000}`}>
        {graph.edges.map((edge,index)=>{
          const from=byId.get(edge.from),to=byId.get(edge.to)
          if(!from||!to)return null
          const id=edge.id??`edge-${index}`
          const a=stand(from,'out',edge.output??'value'),b=stand(to,'in',edge.input??'value')
          // A wire wholly inside one folded group would be a dot; skip it.
          if(folded.get(from.id)&&folded.get(from.id)?.id===folded.get(to.id)?.id)return null
          const mid=wireMidpoint(a,b)
          const active=selection.edges.has(id)||hoverEdge===id
          const carrying=values.get(edge.from)
          return <g key={id} className={`artinos-gwire ${active?'is-active':''}`}>
            <path className="hit" d={wirePath(a,b)}
              onPointerDown={event=>{event.stopPropagation();onSelection({nodes:emptySet,edges:new Set([id])})}}
              onPointerEnter={()=>setHoverEdge(id)} onPointerLeave={()=>setHoverEdge(current=>current===id?null:current)}/>
            <path className="line" d={wirePath(a,b)}/>
            {active&&<g className="artinos-gwire-cut" onPointerDown={event=>{event.stopPropagation();editor.disconnect(id)}}>
              <circle cx={mid.x} cy={mid.y} r="8"/><text x={mid.x} y={mid.y+3}>×</text>
            </g>}
            {!active&&typeof carrying==='number'&&<text className="artinos-gwire-value" x={mid.x} y={mid.y-4}>{carrying.toFixed(2)}</text>}
          </g>
        })}
        {linking&&linkStart&&<path className="artinos-gwire-ghost"
          d={wirePath(
            linking.from.side==='out'?anchor(linkStart,'out',linking.from.portId,collapsed.has(linkStart.id)):linking.pointer,
            linking.from.side==='out'?linking.pointer:anchor(linkStart,'in',linking.from.portId,collapsed.has(linkStart.id)))}/>}
      </svg>

      {graph.nodes.filter(node=>!folded.has(node.id)).map(node=><GraphNodeView
        key={node.id} node={node}
        domain={graph.domain??'signal'}
        value={values.get(node.id)}
        selected={selection.nodes.has(node.id)}
        collapsed={collapsed.has(node.id)}
        severity={severity.get(node.id)}
        sources={sources}
        previewFrame={previews.get(node.id)}
        connectedInputs={connectedInputs.get(node.id)??emptySet}
        onPointerDown={startNodeDrag}
        onPortDown={startLink}
        onPortUp={finishLink}
        onField={setField}
        onToggleCollapse={toggleCollapse}/>)}

      {(graph.groups??[]).map(group=>{
        const box=groupBounds(graph,group,collapsed)
        if(!box)return null
        return <div key={group.id} className={`artinos-ggroup ${group.collapsed?'is-collapsed':''}`}
          style={{left:box.x,top:box.y,width:box.width,height:box.height}}
          onPointerDown={event=>{
            if((event.target as HTMLElement).closest('.artinos-ggroup-bar')===null)return
            event.stopPropagation()
            live.current.onSelection({nodes:new Set(group.nodes),edges:new Set<string>()})
          }}>
          <div className="artinos-ggroup-bar" style={{height:group.collapsed?GROUP_COLLAPSED_H:GROUP_HEADER}}>
            <button type="button" className="artinos-ggroup-fold"
              title={group.collapsed?'Expand this subgraph':'Collapse this subgraph'}
              onPointerDown={event=>event.stopPropagation()}
              onClick={()=>live.current.editor.toggleGroup(group.id)}>{group.collapsed?'▸':'▾'}</button>
            <b>{group.label}</b>
            <span>{group.nodes.length}</span>
          </div>
        </div>
      })}

      {marqueeRect&&<div className="artinos-gmarquee" style={marqueeRect}/>}
    </div>

    <div className="artinos-gzoom">
      <button type="button" title="Zoom out" onClick={()=>zoomBy(1/1.2)}>−</button>
      <output>{Math.round(viewport.zoom*100)}%</output>
      <button type="button" title="Zoom in" onClick={()=>zoomBy(1.2)}>+</button>
      <button type="button" title="Fit to view (F)" onClick={fit}>Fit</button>
    </div>
    {!graph.nodes.length&&<p className="artinos-gempty">Double-click anywhere to add your first node.</p>}
    {palette&&<GraphPalette domain={graph.domain??'signal'} request={palette} onPick={pick} onClose={()=>{setPalette(null);setLinking(null)}}/>}
  </div>
}
