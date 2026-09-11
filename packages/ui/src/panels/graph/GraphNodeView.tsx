import { memo, type PointerEvent as ReactPointerEvent } from 'react'
import { fieldValue, inputsOf, outputsOf, schemaFor, type GraphNode } from '@artinos/graph'
import { NODE_WIDTH, PORT_GAP, PORT_TOP, editableFields, nodeHeight, portRows, previewKind, type PortSide } from './geometry'
import { GraphFieldControl, type FieldSources } from './GraphFieldControl'
import { RenderPreview, ValuePreview, type PreviewFrame } from './GraphNodePreview'

export interface NodeViewProps{
  node:GraphNode
  domain:string
  value?:unknown
  selected:boolean
  collapsed:boolean
  severity?:'error'|'warning'
  sources:FieldSources
  previewFrame?:PreviewFrame
  onPointerDown(event:ReactPointerEvent,node:GraphNode):void
  onPortDown(event:ReactPointerEvent,node:GraphNode,side:PortSide,portId:string):void
  onPortUp(event:ReactPointerEvent,node:GraphNode,side:PortSide,portId:string):void
  /** Takes the node so the parent can pass one stable identity for every node. */
  onField(node:GraphNode,fieldId:string,value:unknown):void
  onToggleCollapse(node:GraphNode):void
  connectedInputs:ReadonlySet<string>
}

const format=(value:unknown)=>{
  if(typeof value==='number')return Number.isFinite(value)?value.toFixed(3):'—'
  if(typeof value==='boolean')return value?'true':'false'
  if(value&&typeof value==='object')return (value as{name?:string}).name||'object'
  return value===undefined?'—':String(value)
}

export const GraphNodeView=memo(function GraphNodeView({
  node,domain,value,selected,collapsed,severity,sources,previewFrame,
  onPointerDown,onPortDown,onPortUp,onField,onToggleCollapse,connectedInputs,
}:NodeViewProps){
  const schema=schemaFor(node.type),inputs=inputsOf(node),outputs=outputsOf(node)
  const preview=previewKind(node,domain)
  const effectId=String(fieldValue(node,'id')??'')
  return <article
    className={`artinos-gnode ${selected?'is-selected':''} ${collapsed?'is-collapsed':''} ${severity?`is-${severity}`:''} cat-${schema?.category?.toLowerCase()??'source'}`}
    style={{left:node.x??0,top:node.y??0,width:NODE_WIDTH,height:nodeHeight(node,domain,collapsed)}}
    data-node={node.id}
    onPointerDown={event=>onPointerDown(event,node)}>

    <header title={schema?.description}>
      <button
        type="button" className="artinos-gnode-fold" title={collapsed?'Expand node':'Collapse node'}
        onPointerDown={event=>event.stopPropagation()}
        onClick={()=>onToggleCollapse(node)}>{collapsed?'▸':'▾'}</button>
      <span>{node.label??schema?.label??node.type}</span>
      <output>{format(value)}</output>
    </header>

    {!collapsed&&<>
      <div className="artinos-gnode-ports" style={{height:PORT_TOP+portRows(node)*PORT_GAP}}>
        {inputs.map((port,index)=><button
          key={`in-${port.id}`} type="button"
          className={`artinos-gport side-in type-${port.type} ${connectedInputs.has(port.id)?'is-linked':''} ${port.required?'is-required':''}`}
          style={{top:PORT_TOP+index*PORT_GAP}}
          data-port={port.id} data-side="in"
          title={`${port.label??port.id} · ${port.type}${port.required?' · required':''}${port.multiple?' · accepts many':''}`}
          onPointerDown={event=>onPortDown(event,node,'in',port.id)}
          onPointerUp={event=>onPortUp(event,node,'in',port.id)}><i/><b>{port.label??port.id}</b></button>)}
        {outputs.map((port,index)=><button
          key={`out-${port.id}`} type="button"
          className={`artinos-gport side-out type-${port.type}`}
          style={{top:PORT_TOP+index*PORT_GAP}}
          data-port={port.id} data-side="out"
          title={`${port.label??port.id} · ${port.type}`}
          onPointerDown={event=>onPortDown(event,node,'out',port.id)}
          onPointerUp={event=>onPortUp(event,node,'out',port.id)}><b>{port.label??port.id}</b><i/></button>)}
      </div>

      {editableFields(node).map(field=><GraphFieldControl
        key={field.id} field={field} value={fieldValue(node,field.id)} sources={sources} compact effectId={effectId}
        onChange={next=>onField(node,field.id,next)}/>)}

      {preview!=='none'&&<div className="artinos-gpreview" onPointerDown={event=>event.stopPropagation()}>
        {preview==='render'
          ?<RenderPreview nodeKey={node.id} frame={previewFrame}/>
          :<ValuePreview nodeKey={node.id} value={typeof value==='number'?value:0}/>}
      </div>}
    </>}
  </article>
},(previous,next)=>
  previous.node===next.node&&previous.value===next.value&&previous.selected===next.selected&&
  previous.collapsed===next.collapsed&&previous.severity===next.severity&&previous.sources===next.sources&&
  previous.previewFrame===next.previewFrame&&previous.domain===next.domain&&previous.connectedInputs===next.connectedInputs)
