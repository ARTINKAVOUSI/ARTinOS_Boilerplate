import { useEffect, useMemo, useRef, useState } from 'react'
import { GRAPH_CATEGORIES, schemasForDomain, type GraphDomain, type GraphNodeType, type GraphValueType } from '@artinos/graph'
import { SearchField } from '@artinos/ui'

export interface PaletteRequest{x:number;y:number;screenX:number;screenY:number;link?:{nodeId:string;portId:string;side:'in'|'out';type:GraphValueType}}

/** Node picker. Opened from the toolbar, by double-clicking the canvas, or by dropping a wire on empty space. */
export function GraphPalette({domain,request,onPick,onClose}:{
  domain:GraphDomain;request:PaletteRequest;onPick(type:GraphNodeType):void;onClose():void
}){
  const [query,setQuery]=useState(''),[index,setIndex]=useState(0)
  const ref=useRef<HTMLDivElement>(null)
  const schemas=useMemo(()=>schemasForDomain(domain),[domain])
  // When a wire opened the palette, only nodes that can accept or produce it are offered.
  const relevant=useMemo(()=>{
    if(!request.link)return schemas
    const wants=request.link.side==='out'?'inputs':'outputs'
    return schemas.filter(schema=>schema[wants].length>0)
  },[schemas,request.link])
  const matches=useMemo(()=>{
    const needle=query.trim().toLowerCase()
    if(!needle)return relevant
    return relevant.filter(schema=>`${schema.label} ${schema.type} ${schema.category} ${schema.description}`.toLowerCase().includes(needle))
  },[relevant,query])
  const grouped=useMemo(()=>GRAPH_CATEGORIES
    .map(category=>({category,items:matches.filter(schema=>schema.category===category)}))
    .filter(group=>group.items.length),[matches])
  const flat=useMemo(()=>grouped.flatMap(group=>group.items),[grouped])

  useEffect(()=>setIndex(0),[query])
  useEffect(()=>{ref.current?.querySelector('input')?.focus()},[])
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))onClose()}
    window.addEventListener('pointerdown',dismiss)
    return()=>window.removeEventListener('pointerdown',dismiss)
  },[onClose])

  return <div
    ref={ref} className="artinos-gpalette" style={{left:request.screenX,top:request.screenY}}
    onPointerDown={event=>event.stopPropagation()}
    onKeyDown={event=>{
      event.stopPropagation()
      if(event.key==='ArrowDown'){event.preventDefault();setIndex(value=>Math.min(flat.length-1,value+1))}
      if(event.key==='ArrowUp'){event.preventDefault();setIndex(value=>Math.max(0,value-1))}
      if(event.key==='Enter'&&flat[index]){event.preventDefault();onPick(flat[index].type)}
      if(event.key==='Escape'){event.preventDefault();onClose()}
    }}>
    <SearchField value={query} onChange={setQuery} placeholder={request.link?'Connect a new node…':'Add a node…'}/>
    <div className="artinos-gpalette-list">
      {grouped.map(group=><section key={group.category}>
        <h6>{group.category}</h6>
        {group.items.map(schema=><button
          key={schema.type} type="button"
          className={flat.indexOf(schema)===index?'is-active':''}
          onPointerEnter={()=>setIndex(flat.indexOf(schema))}
          onClick={()=>onPick(schema.type)}>
          <b>{schema.label}</b><small>{schema.description}</small>
        </button>)}
      </section>)}
      {!grouped.length&&<p>No node matches “{query}”.</p>}
    </div>
  </div>
}
