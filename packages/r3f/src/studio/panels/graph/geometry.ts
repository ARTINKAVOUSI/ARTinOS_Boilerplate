import { inputsOf, outputsOf, schemaFor, topologicalOrder, type GraphDefinition, type GraphGroup, type GraphNode } from '@artinos/graph'

export const NODE_WIDTH=228,HEADER_H=30,PORT_TOP=15,PORT_GAP=18,FIELD_H=25,NODE_PAD=10,GRID=12
export const PREVIEW_W=204,PREVIEW_H=64,PREVIEW_PAD=8
export const COLUMN=NODE_WIDTH+64,ROW=210

export type PortSide='in'|'out'
export interface Point{x:number;y:number}

/** Nodes whose output is a TSL node get a rendered thumbnail; numeric nodes get a plot. */
export const previewKind=(node:GraphNode,domain:string):'render'|'value'|'none'=>{
  const schema=schemaFor(node.type)
  if(!schema)return 'none'
  if(domain==='gpu')return schema.outputs.length?'render':'none'
  if(domain==='scene'&&(schema.category==='Scene'))return 'none'
  if(domain==='render'&&schema.category==='Render')return 'none'
  return schema.outputs.some(port=>port.type==='number')?'value':'none'
}

export const editableFields=(node:GraphNode)=>schemaFor(node.type)?.fields??[]
export const portRows=(node:GraphNode)=>Math.max(inputsOf(node).length,outputsOf(node).length)

export function nodeHeight(node:GraphNode,domain:string,collapsed=false){
  if(collapsed)return HEADER_H
  const ports=PORT_TOP+portRows(node)*PORT_GAP
  const fields=editableFields(node).length*FIELD_H
  const preview=previewKind(node,domain)==='none'?0:PREVIEW_H+PREVIEW_PAD
  return HEADER_H+ports+fields+preview+NODE_PAD
}

export const portsOf=(node:GraphNode,side:PortSide)=>side==='out'?outputsOf(node):inputsOf(node)
export const portPoint=(node:GraphNode,side:PortSide,index:number):Point=>
  ({x:(node.x??0)+(side==='out'?NODE_WIDTH:0),y:(node.y??0)+HEADER_H+PORT_TOP+index*PORT_GAP})
export const anchor=(node:GraphNode,side:PortSide,portId:string,collapsed=false):Point=>{
  // A collapsed node keeps every wire attached to its header edge.
  if(collapsed)return {x:(node.x??0)+(side==='out'?NODE_WIDTH:0),y:(node.y??0)+HEADER_H/2}
  const index=portsOf(node,side).findIndex(port=>port.id===portId)
  return portPoint(node,side,index<0?0:index)
}
export const wirePath=(a:Point,b:Point)=>{
  const bend=Math.max(36,Math.min(150,Math.abs(b.x-a.x)*.55))
  return `M ${a.x} ${a.y} C ${a.x+bend} ${a.y}, ${b.x-bend} ${b.y}, ${b.x} ${b.y}`
}
export const wireMidpoint=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
export const snap=(value:number,enabled=true)=>enabled?Math.round(value/GRID)*GRID:Math.round(value)

export function graphBounds(graph:GraphDefinition,collapsed:ReadonlySet<string>=new Set()){
  if(!graph.nodes.length)return {x:0,y:0,width:COLUMN*2,height:ROW*2}
  const domain=graph.domain??'signal'
  const left=Math.min(...graph.nodes.map(node=>node.x??0)),top=Math.min(...graph.nodes.map(node=>node.y??0))
  const right=Math.max(...graph.nodes.map(node=>(node.x??0)+NODE_WIDTH))
  const bottom=Math.max(...graph.nodes.map(node=>(node.y??0)+nodeHeight(node,domain,collapsed.has(node.id))))
  return {x:left,y:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)}
}

/** Dependency-depth columns, keeping each column in its current vertical order. */
export function autoLayout(graph:GraphDefinition):GraphNode[]{
  const {order,cyclic}=topologicalOrder(graph),depth=new Map<string,number>()
  for(const node of order){
    const incoming=graph.edges.filter(edge=>edge.to===node.id)
    depth.set(node.id,incoming.length?Math.max(...incoming.map(edge=>(depth.get(edge.from)??0)+1)):0)
  }
  for(const id of cyclic)depth.set(id,0)
  const columns=new Map<number,GraphNode[]>()
  for(const node of [...graph.nodes].sort((a,b)=>(a.y??0)-(b.y??0))){
    const level=depth.get(node.id)??0
    columns.set(level,[...(columns.get(level)??[]),node])
  }
  const domain=graph.domain??'signal'
  const moved=new Map<string,GraphNode>()
  for(const [level,nodes] of columns){
    let y=36
    for(const node of nodes){
      moved.set(node.id,{...node,x:36+level*COLUMN,y})
      y+=nodeHeight(node,domain)+34
    }
  }
  return graph.nodes.map(node=>moved.get(node.id)??node)
}

export type ArrangeMode='align-left'|'align-right'|'align-top'|'align-bottom'|'distribute-h'|'distribute-v'|'row'|'column'

/** Aligns or evenly spaces the given nodes; everything else keeps its position. */
export function arrangeNodes(graph:GraphDefinition,ids:readonly string[],mode:ArrangeMode):GraphNode[]{
  const set=new Set(ids)
  const picked=graph.nodes.filter(node=>set.has(node.id))
  if(picked.length<2)return graph.nodes
  const domain=graph.domain??'signal'
  const left=Math.min(...picked.map(node=>node.x??0)),top=Math.min(...picked.map(node=>node.y??0))
  const right=Math.max(...picked.map(node=>(node.x??0)+NODE_WIDTH)),bottom=Math.max(...picked.map(node=>(node.y??0)+nodeHeight(node,domain)))
  const moved=new Map<string,{x:number;y:number}>()

  if(mode==='align-left')for(const node of picked)moved.set(node.id,{x:left,y:node.y??0})
  if(mode==='align-right')for(const node of picked)moved.set(node.id,{x:right-NODE_WIDTH,y:node.y??0})
  if(mode==='align-top')for(const node of picked)moved.set(node.id,{x:node.x??0,y:top})
  if(mode==='align-bottom')for(const node of picked)moved.set(node.id,{x:node.x??0,y:bottom-nodeHeight(node,domain)})
  if(mode==='distribute-h'){
    const order=[...picked].sort((a,b)=>(a.x??0)-(b.x??0))
    const step=(right-left-NODE_WIDTH)/(order.length-1)
    order.forEach((node,index)=>moved.set(node.id,{x:Math.round(left+step*index),y:node.y??0}))
  }
  if(mode==='distribute-v'){
    const order=[...picked].sort((a,b)=>(a.y??0)-(b.y??0))
    const span=bottom-top-nodeHeight(order[order.length-1],domain)
    const step=span/(order.length-1)
    order.forEach((node,index)=>moved.set(node.id,{x:node.x??0,y:Math.round(top+step*index)}))
  }
  if(mode==='row'){
    const order=[...picked].sort((a,b)=>(a.x??0)-(b.x??0))
    let x=left
    for(const node of order){moved.set(node.id,{x,y:top});x+=NODE_WIDTH+48}
  }
  if(mode==='column'){
    const order=[...picked].sort((a,b)=>(a.y??0)-(b.y??0))
    let y=top
    for(const node of order){moved.set(node.id,{x:left,y});y+=nodeHeight(node,domain)+28}
  }
  return graph.nodes.map(node=>{const next=moved.get(node.id);return next?{...node,...next}:node})
}

export const GROUP_PAD=18,GROUP_HEADER=22,GROUP_COLLAPSED_H=54

/** The box a group draws, either around its members or standing in for them. */
export function groupBounds(graph:GraphDefinition,group:GraphGroup,collapsed:ReadonlySet<string>){
  const members=graph.nodes.filter(node=>group.nodes.includes(node.id))
  if(!members.length)return null
  if(group.collapsed){
    // A folded group sits at its top-left corner at one node's width.
    const left=Math.min(...members.map(node=>node.x??0))
    const top=Math.min(...members.map(node=>node.y??0))
    return {x:left,y:top,width:NODE_WIDTH,height:GROUP_COLLAPSED_H}
  }
  const domain=graph.domain??'signal'
  const left=Math.min(...members.map(node=>node.x??0))-GROUP_PAD
  const top=Math.min(...members.map(node=>node.y??0))-GROUP_PAD-GROUP_HEADER
  const right=Math.max(...members.map(node=>(node.x??0)+NODE_WIDTH))+GROUP_PAD
  const bottom=Math.max(...members.map(node=>(node.y??0)+nodeHeight(node,domain,collapsed.has(node.id))))+GROUP_PAD
  return {x:left,y:top,width:right-left,height:bottom-top}
}
