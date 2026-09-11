import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { wirePath } from './geometry'
import { LIVE_COLUMNS, LIVE_COLUMN_STEP, LIVE_NODE_WIDTH, liveGraphBounds, type LiveControl, type LiveGraph, type LiveNode } from './live-graph'
import { RenderPreview, ValuePreview, type PreviewFrame } from './GraphNodePreview'
import { NumberField, Toggle } from '../../primitives'

const MIN_ZOOM=.25,MAX_ZOOM=1.8

/**
 * The running system drawn as real nodes: every control writes straight through
 * to the live thing. The layout is generated rather than authored, so there is
 * no palette, wiring or undo here — the topology is whatever is actually running.
 */
export function LiveGraphView({graph,previews,onInspect,onControl,insetRight=0}:{
  graph:LiveGraph
  previews?:ReadonlyMap<string,PreviewFrame>
  onInspect?(node:LiveNode):void
  onControl(node:LiveNode,control:LiveControl,value:number|boolean):void
  /** Width of the overlay covering the right edge, so fitting does not hide a column behind it. */
  insetRight?:number
}){
  const surfaceRef=useRef<HTMLDivElement>(null)
  const [viewport,setViewport]=useState({x:0,y:0,zoom:.8})
  const [hover,setHover]=useState<string|null>(null)
  const [selected,setSelected]=useState<string|null>(null)
  const byId=useMemo(()=>new Map(graph.nodes.map(node=>[node.id,node])),[graph.nodes])
  const bounds=useMemo(()=>liveGraphBounds(graph),[graph])

  const fit=useCallback(()=>{
    const rect=surfaceRef.current?.getBoundingClientRect()
    if(!rect||!graph.nodes.length)return
    const margin=48
    const usable=Math.max(240,rect.width-margin*2-insetRight)
    const zoom=Math.max(MIN_ZOOM,Math.min(1,Math.min(usable/bounds.width,(rect.height-margin*2)/bounds.height)))
    setViewport({zoom,x:margin,y:Math.max(margin,rect.height/2-(bounds.height*zoom)/2)})
  },[bounds,graph.nodes.length,insetRight])
  // Fit once on mount; the graph rebuilds constantly, so refitting would jitter.
  useEffect(()=>{const id=window.setTimeout(fit);return()=>window.clearTimeout(id)
  },[])// eslint-disable-line

  useEffect(()=>{
    const surface=surfaceRef.current
    if(!surface)return
    const onWheel=(event:WheelEvent)=>{
      event.preventDefault()
      const rect=surface.getBoundingClientRect()
      const pivot={x:event.clientX-rect.left,y:event.clientY-rect.top}
      setViewport(current=>{
        const zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,current.zoom*(event.deltaY<0?1.12:1/1.12)))
        const scale=zoom/current.zoom
        return {zoom,x:pivot.x-(pivot.x-current.x)*scale,y:pivot.y-(pivot.y-current.y)*scale}
      })
    }
    surface.addEventListener('wheel',onWheel,{passive:false})
    return()=>surface.removeEventListener('wheel',onWheel)
  },[])

  const pan=(event:ReactPointerEvent)=>{
    if((event.target as HTMLElement).closest('.artinos-lnode'))return
    if((event.target as HTMLElement).closest('input,select,button'))return
    const startX=event.clientX,startY=event.clientY,origin={...viewport}
    const move=(next:PointerEvent)=>setViewport({...origin,x:origin.x+next.clientX-startX,y:origin.y+next.clientY-startY})
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }

  const anchor=(node:LiveNode,side:'in'|'out')=>({x:node.x+(side==='out'?LIVE_NODE_WIDTH:0),y:node.y+node.height/2})
  const connected=useMemo(()=>{
    if(!hover&&!selected)return null
    const focus=hover??selected as string
    const set=new Set<string>([focus])
    for(const edge of graph.edges){
      if(edge.from===focus)set.add(edge.to)
      if(edge.to===focus)set.add(edge.from)
    }
    return set
  },[graph.edges,hover,selected])

  return <div ref={surfaceRef} className="artinos-gcanvas artinos-lcanvas" onPointerDown={pan}>
    <div className="artinos-gviewport" style={{transform:`translate(${viewport.x}px,${viewport.y}px) scale(${viewport.zoom})`}}>
      <div className="artinos-lcolumns" style={{width:bounds.width,height:bounds.height}}>
        {LIVE_COLUMNS.map((label,index)=><span key={label} style={{left:index*LIVE_COLUMN_STEP,width:LIVE_NODE_WIDTH}}>{label}</span>)}
      </div>

      <svg className="artinos-gwires" style={{left:-1200,top:-1200,width:bounds.width+2400,height:bounds.height+2400}}
        viewBox={`${-1200} ${-1200} ${bounds.width+2400} ${bounds.height+2400}`}>
        {graph.edges.map(edge=>{
          const from=byId.get(edge.from),to=byId.get(edge.to)
          if(!from||!to)return null
          const dim=connected&&!(connected.has(edge.from)&&connected.has(edge.to))
          return <path key={edge.id} className={`artinos-lwire ${dim?'is-dim':''}`} d={wirePath(anchor(from,'out'),anchor(to,'in'))}/>
        })}
      </svg>

      {graph.nodes.map(node=><article
        key={node.id}
        className={`artinos-lnode kind-${node.kind} ${node.muted?'is-muted':''} ${selected===node.id?'is-selected':''} ${connected&&!connected.has(node.id)?'is-dim':''}`}
        style={{left:node.x,top:node.y,width:LIVE_NODE_WIDTH,height:node.height}}
        onPointerEnter={()=>setHover(node.id)}
        onPointerLeave={()=>setHover(current=>current===node.id?null:current)}>
        {graph.edges.some(edge=>edge.to===node.id)&&<i className="artinos-lport side-in" aria-hidden="true"/>}
        {graph.edges.some(edge=>edge.from===node.id)&&<i className="artinos-lport side-out" aria-hidden="true"/>}

        <button type="button" className="artinos-lnode-head"
          onClick={()=>{setSelected(current=>current===node.id?null:node.id);onInspect?.(node)}}>
          <span className="artinos-lnode-main">
            <b title={node.title}>{node.title}</b>
            {node.detail&&<small title={node.detail}>{node.detail}</small>}
          </span>
          <span className="artinos-lnode-side">
            <em>{node.subtitle}</em>
            {node.value!==undefined&&<output>{node.value}</output>}
          </span>
        </button>

        {node.controls.map(control=><div key={control.id} className="artinos-lnode-control artinos-gfield is-compact">
          {control.kind==='boolean'
            ?<Toggle label={control.label} value={control.value} onChange={next=>onControl(node,control,next)}/>
            :control.kind==='number'
              ?<NumberField label={control.label} value={control.value} min={control.min} max={control.max} step={control.step}
                  onChange={next=>onControl(node,control,next)}/>
              :<label className="artinos-control"><span>{control.label}</span><output>{control.value}</output></label>}
        </div>)}

        {node.preview!=='none'&&<div className="artinos-lnode-preview">
          {node.preview==='render'
            ?<RenderPreview nodeKey={node.id} frame={previews?.get(node.id)}/>
            :<ValuePreview nodeKey={`live:${node.id}`} value={typeof node.value==='string'?Number(node.value)||0:Number(node.value??0)}/>}
        </div>}
      </article>)}
    </div>

    <div className="artinos-gzoom">
      <button type="button" title="Zoom out" onClick={()=>setViewport(v=>({...v,zoom:Math.max(MIN_ZOOM,v.zoom/1.2)}))}>−</button>
      <output>{Math.round(viewport.zoom*100)}%</output>
      <button type="button" title="Zoom in" onClick={()=>setViewport(v=>({...v,zoom:Math.min(MAX_ZOOM,v.zoom*1.2)}))}>+</button>
      <button type="button" title="Fit to view" onClick={fit}>Fit</button>
    </div>
    {!graph.nodes.length&&<p className="artinos-gempty">Nothing is running yet.</p>}
  </div>
}
