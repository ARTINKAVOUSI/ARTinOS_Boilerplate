import type { GraphDefinition, GraphDiagnostic, GraphDomain, GraphEdge, GraphNode, GraphNodeType, GraphPort, GraphValueType } from './types'

export type GraphCategory='Source'|'Math'|'Shape'|'Logic'|'Output'|'Scene'|'Render'|'GPU'
export type GraphFieldKind='number'|'boolean'|'text'|'select'|'signal'|'parameter'|'effect'|'effect-parameter'|'scene-object'|'vector3'
export interface GraphField{id:string;label:string;kind:GraphFieldKind;default:unknown;min?:number;max?:number;step?:number;options?:readonly string[];summary?:boolean;description?:string}
export interface GraphNodeSchema{type:GraphNodeType;label:string;category:GraphCategory;domains:readonly GraphDomain[];description:string;inputs:readonly GraphPort[];outputs:readonly GraphPort[];fields:readonly GraphField[]}

const NUMERIC_DOMAINS=['signal','parameter','scene','render'] as const
const ALL_DOMAINS=['signal','parameter','scene','render','gpu'] as const
const title=(id:string)=>id.replace(/[-_]/g,' ').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/\b\w/g,letter=>letter.toUpperCase())
const port=(id:string,type:GraphValueType='number',extra:Partial<GraphPort>={}):GraphPort=>({id,label:title(id),type,...extra})
const out=(type:GraphValueType='number')=>[port('value',type)]
const num=(id:string,def:number,extra:Partial<GraphField>={}):GraphField=>({id,label:title(id),kind:'number',default:def,step:.01,...extra})

export const NODE_SCHEMAS:readonly GraphNodeSchema[]=[
  // ── Sources ────────────────────────────────────────────────────────────────
  {type:'constant',label:'Constant',category:'Source',domains:ALL_DOMAINS,description:'A fixed number.',
    inputs:[],outputs:out(),fields:[num('value',1,{summary:true})]},
  {type:'signal',label:'Signal',category:'Source',domains:ALL_DOMAINS,description:'Reads a live signal such as audio.bass or pointer.x. In a GPU graph it becomes a uniform updated every frame.',
    inputs:[],outputs:out(),fields:[{id:'id',label:'Signal',kind:'signal',default:'audio.bass',summary:true}]},
  {type:'parameter',label:'Parameter',category:'Source',domains:ALL_DOMAINS,description:'Reads a registered parameter. In a GPU graph it becomes a uniform updated every frame.',
    inputs:[],outputs:out(),fields:[{id:'id',label:'Parameter',kind:'parameter',default:'',summary:true}]},
  {type:'time',label:'Time',category:'Source',domains:ALL_DOMAINS,description:'Seconds since start, scaled and offset.',
    inputs:[],outputs:out(),fields:[num('speed',1,{summary:true}),num('offset',0)]},
  {type:'uv',label:'UV',category:'GPU',domains:['gpu'],description:'Screen/surface UV coordinates as a TSL node.',
    inputs:[],outputs:out('node'),fields:[]},
  {type:'uniform',label:'Uniform',category:'GPU',domains:['gpu'],description:'A writable TSL uniform seeded with a literal value.',
    inputs:[],outputs:out('node'),fields:[num('value',1,{summary:true})]},

  // ── Math ───────────────────────────────────────────────────────────────────
  {type:'add',label:'Add',category:'Math',domains:ALL_DOMAINS,description:'Sums every connected input.',
    inputs:[port('values','number',{multiple:true})],outputs:out(),fields:[]},
  {type:'multiply',label:'Multiply',category:'Math',domains:ALL_DOMAINS,description:'Multiplies every connected input.',
    inputs:[port('values','number',{multiple:true})],outputs:out(),fields:[]},
  {type:'min',label:'Min',category:'Math',domains:ALL_DOMAINS,description:'Smallest connected input.',
    inputs:[port('values','number',{multiple:true})],outputs:out(),fields:[]},
  {type:'max',label:'Max',category:'Math',domains:ALL_DOMAINS,description:'Largest connected input.',
    inputs:[port('values','number',{multiple:true})],outputs:out(),fields:[]},
  {type:'subtract',label:'Subtract',category:'Math',domains:ALL_DOMAINS,description:'A minus B.',
    inputs:[port('a'),port('b')],outputs:out(),fields:[num('b',0,{description:'Used when B is not connected'})]},
  {type:'divide',label:'Divide',category:'Math',domains:ALL_DOMAINS,description:'A divided by B. Division by zero yields A.',
    inputs:[port('a'),port('b')],outputs:out(),fields:[num('b',1,{description:'Used when B is not connected'})]},
  {type:'modulo',label:'Modulo',category:'Math',domains:NUMERIC_DOMAINS,description:'Remainder of A divided by B.',
    inputs:[port('a'),port('b')],outputs:out(),fields:[num('b',1)]},
  {type:'pow',label:'Power',category:'Math',domains:ALL_DOMAINS,description:'A raised to B.',
    inputs:[port('a'),port('b')],outputs:out(),fields:[num('power',2)]},
  {type:'abs',label:'Absolute',category:'Math',domains:ALL_DOMAINS,description:'Distance from zero.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'negate',label:'Negate',category:'Math',domains:NUMERIC_DOMAINS,description:'Flips the sign.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'sign',label:'Sign',category:'Math',domains:NUMERIC_DOMAINS,description:'-1, 0 or 1.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'floor',label:'Floor',category:'Math',domains:NUMERIC_DOMAINS,description:'Rounds down.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'fract',label:'Fraction',category:'Math',domains:NUMERIC_DOMAINS,description:'Fractional part, always 0–1.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'sqrt',label:'Square Root',category:'Math',domains:NUMERIC_DOMAINS,description:'Square root of a non-negative input.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'sin',label:'Sine',category:'Math',domains:ALL_DOMAINS,description:'Sine of the input in radians.',
    inputs:[port('value')],outputs:out(),fields:[]},
  {type:'cos',label:'Cosine',category:'Math',domains:ALL_DOMAINS,description:'Cosine of the input in radians.',
    inputs:[port('value')],outputs:out(),fields:[]},

  // ── Shaping ────────────────────────────────────────────────────────────────
  {type:'remap',label:'Remap',category:'Shape',domains:ALL_DOMAINS,description:'Rescales an input range onto an output range.',
    inputs:[port('value')],outputs:out(),fields:[num('inMin',0),num('inMax',1),num('outMin',0,{summary:true}),num('outMax',1,{summary:true})]},
  {type:'clamp',label:'Clamp',category:'Shape',domains:ALL_DOMAINS,description:'Holds the input inside a range.',
    inputs:[port('value')],outputs:out(),fields:[num('min',0),num('max',1)]},
  {type:'smoothstep',label:'Smoothstep',category:'Shape',domains:ALL_DOMAINS,description:'Eased 0–1 ramp between two edges.',
    inputs:[port('value')],outputs:out(),fields:[num('min',0),num('max',1)]},
  {type:'mix',label:'Mix',category:'Shape',domains:ALL_DOMAINS,description:'Blends A and B by T.',
    inputs:[port('a'),port('b'),port('t')],outputs:out(),fields:[num('t',.5,{min:0,max:1})]},
  {type:'noise',label:'Noise',category:'Shape',domains:NUMERIC_DOMAINS,description:'Deterministic -1..1 value hashed from the input, or from time when unconnected.',
    inputs:[port('value')],outputs:out(),fields:[num('frequency',1,{summary:true}),num('seed',0)]},
  {type:'oscillator',label:'Oscillator',category:'Shape',domains:NUMERIC_DOMAINS,description:'Free-running waveform. Connect Frequency to modulate its rate.',
    inputs:[port('frequency')],outputs:out(),fields:[
      {id:'wave',label:'Wave',kind:'select',default:'sine',options:['sine','triangle','saw','square'],summary:true},
      num('frequency',1,{min:0,max:20}),num('phase',0,{min:0,max:1}),num('amplitude',1),num('offset',0)]},
  {type:'smooth',label:'Smooth',category:'Shape',domains:NUMERIC_DOMAINS,description:'Frame-rate independent one-pole smoothing. 0 passes through, 1 holds still.',
    inputs:[port('value')],outputs:out(),fields:[num('amount',.85,{min:0,max:.999,summary:true})]},

  // ── Logic ──────────────────────────────────────────────────────────────────
  {type:'condition',label:'Condition',category:'Logic',domains:NUMERIC_DOMAINS,description:'Outputs Yes when Value passes the threshold, otherwise No.',
    inputs:[port('value'),port('yes'),port('no')],outputs:out(),fields:[
      {id:'comparison',label:'Comparison',kind:'select',default:'>',options:['>','>=','<','<=']},
      num('threshold',.5,{summary:true}),num('yes',1),num('no',0)]},

  // ── Outputs ────────────────────────────────────────────────────────────────
  {type:'write-parameter',label:'Write Parameter',category:'Output',domains:NUMERIC_DOMAINS,description:'Drives a registered parameter every frame. This is a resolved write; the base value the panels edit is untouched.',
    inputs:[port('value','number',{required:true})],outputs:out(),fields:[{id:'id',label:'Parameter',kind:'parameter',default:'',summary:true}]},
  {type:'write-signal',label:'Write Signal',category:'Output',domains:NUMERIC_DOMAINS,description:'Publishes the input as a named signal other graphs, bindings and panels can read.',
    inputs:[port('value','number',{required:true})],outputs:out(),fields:[{id:'id',label:'Signal',kind:'text',default:'graph.output',summary:true}]},
  {type:'output',label:'TSL Output',category:'GPU',domains:['gpu'],description:'Publishes the compiled TSL node as the resource graph.<id>.tsl.',
    inputs:[port('value','node',{required:true})],outputs:[],fields:[{id:'target',label:'Target',kind:'text',default:'resource'}]},

  // ── Scene ──────────────────────────────────────────────────────────────────
  {type:'scene-object',label:'Scene Object',category:'Scene',domains:['scene'],description:'Resolves a named object in the live scene.',
    inputs:[],outputs:[port('object','object')],fields:[{id:'object',label:'Object',kind:'scene-object',default:'',summary:true}]},
  {type:'transform',label:'Transform',category:'Scene',domains:['scene'],description:'Writes position, rotation and scale. Connect any channel to drive it from a number; unconnected channels keep their authored value.',
    inputs:[port('object','object',{required:true}),port('positionX'),port('positionY'),port('positionZ'),port('rotationX'),port('rotationY'),port('rotationZ'),port('scale')],
    outputs:[port('object','object')],fields:[
      {id:'position',label:'Position',kind:'vector3',default:[0,0,0]},
      {id:'rotation',label:'Rotation',kind:'vector3',default:[0,0,0]},
      {id:'scale',label:'Scale',kind:'vector3',default:[1,1,1]}]},
  {type:'visible',label:'Visibility',category:'Scene',domains:['scene'],description:'Shows or hides the object. A connected number above 0.5 counts as visible.',
    inputs:[port('object','object',{required:true}),port('value')],outputs:[port('object','object')],fields:[{id:'value',label:'Visible',kind:'boolean',default:true,summary:true}]},
  {type:'material-parameter',label:'Material Property',category:'Scene',domains:['scene'],description:'Writes a numeric property on the object material, such as roughness or opacity.',
    inputs:[port('object','object',{required:true}),port('value')],outputs:[port('object','object')],fields:[
      {id:'property',label:'Property',kind:'text',default:'roughness',summary:true},num('value',.5)]},

  // ── Render ─────────────────────────────────────────────────────────────────
  {type:'effect-enabled',label:'Effect Enabled',category:'Render',domains:['render'],description:'Toggles a PostFX effect in the shared pipeline. A connected number above 0.5 enables it.',
    inputs:[port('value')],outputs:[],fields:[{id:'id',label:'Effect',kind:'effect',default:'',summary:true},{id:'enabled',label:'Enabled',kind:'boolean',default:true}]},
  {type:'effect-order',label:'Effect Order',category:'Render',domains:['render'],description:'Moves a PostFX effect to a position in the pipeline.',
    inputs:[],outputs:[],fields:[{id:'id',label:'Effect',kind:'effect',default:'',summary:true},num('order',0,{step:1})]},
  {type:'effect-parameter',label:'Effect Parameter',category:'Render',domains:['render'],description:'Writes one PostFX parameter. Connect Value to make it audio- or pointer-reactive.',
    inputs:[port('value')],outputs:[],fields:[
      {id:'id',label:'Effect',kind:'effect',default:'',summary:true},
      {id:'parameter',label:'Parameter',kind:'effect-parameter',default:'',summary:true},num('value',1)]},
]

const SCHEMA_BY_TYPE=new Map(NODE_SCHEMAS.map(schema=>[schema.type,schema]))
export const schemaFor=(type:GraphNodeType)=>SCHEMA_BY_TYPE.get(type)
export const nodeTypesForDomain=(domain:GraphDomain):readonly GraphNodeType[]=>NODE_SCHEMAS.filter(schema=>schema.domains.includes(domain)).map(schema=>schema.type)
export const schemasForDomain=(domain:GraphDomain)=>NODE_SCHEMAS.filter(schema=>schema.domains.includes(domain))
export const GRAPH_CATEGORIES:readonly GraphCategory[]=['Source','Math','Shape','Logic','Output','Scene','Render','GPU']

/** Schema ports, overridden by any explicit ports a stored node carries. */
export const inputsOf=(node:GraphNode):readonly GraphPort[]=>node.inputs??schemaFor(node.type)?.inputs??[]
export const outputsOf=(node:GraphNode):readonly GraphPort[]=>node.outputs??schemaFor(node.type)?.outputs??[]
export const defaultData=(type:GraphNodeType):Record<string,unknown>=>Object.fromEntries((schemaFor(type)?.fields??[]).map(field=>[field.id,field.default]))
export const fieldValue=(node:GraphNode,id:string)=>node.data?.[id]??schemaFor(node.type)?.fields.find(field=>field.id===id)?.default

let sequence=0
export function createNode(type:GraphNodeType,x=0,y=0,data:Record<string,unknown>={}):GraphNode{
  return {id:`${type}-${(++sequence).toString(36)}${Date.now().toString(36).slice(-4)}`,type,x:Math.round(x),y:Math.round(y),data:{...defaultData(type),...data}}
}

/** A GPU graph carries TSL nodes on wires that numeric schemas describe as numbers. */
const compatible=(from:GraphValueType,to:GraphValueType,domain:GraphDomain)=>{
  if(from===to||from==='any'||to==='any')return true
  if(domain==='gpu')return(from==='number'||from==='node')&&(to==='number'||to==='node')
  return false
}
export const canConnect=(graph:GraphDefinition,fromNode:GraphNode,outputId:string,toNode:GraphNode,inputId:string):string|undefined=>{
  if(fromNode.id===toNode.id)return 'A node cannot feed itself'
  const output=outputsOf(fromNode).find(item=>item.id===outputId),input=inputsOf(toNode).find(item=>item.id===inputId)
  if(!output)return `${fromNode.type} has no output ${outputId}`
  if(!input)return `${toNode.type} has no input ${inputId}`
  if(!compatible(output.type,input.type,graph.domain??'signal'))return `${output.type} does not fit ${input.type}`
  if(graph.edges.some(edge=>edge.from===fromNode.id&&edge.to===toNode.id&&(edge.output??'value')===outputId&&(edge.input??'value')===inputId))return 'Already connected'
  if(!input.multiple&&graph.edges.some(edge=>edge.to===toNode.id&&(edge.input??'value')===inputId))return `${input.label??input.id} already has a connection`
  if(reaches(graph,toNode.id,fromNode.id))return 'That would create a cycle'
  return undefined
}
const reaches=(graph:GraphDefinition,from:string,target:string,seen=new Set<string>()):boolean=>{
  if(from===target)return true
  if(seen.has(from))return false
  seen.add(from)
  return graph.edges.filter(edge=>edge.from===from).some(edge=>reaches(graph,edge.to,target,seen))
}

/** Dependency-first node order, or the offending nodes when the graph cannot resolve. */
export function topologicalOrder(graph:GraphDefinition):{order:GraphNode[];cyclic:string[]}{
  const incoming=new Map(graph.nodes.map(node=>[node.id,graph.edges.filter(edge=>edge.to===node.id&&graph.nodes.some(item=>item.id===edge.from)).length]))
  const ready=graph.nodes.filter(node=>!incoming.get(node.id)),order:GraphNode[]=[]
  while(ready.length){
    const node=ready.shift() as GraphNode
    order.push(node)
    for(const edge of graph.edges.filter(item=>item.from===node.id)){
      const remaining=(incoming.get(edge.to)??0)-1
      incoming.set(edge.to,remaining)
      if(remaining===0){const next=graph.nodes.find(item=>item.id===edge.to);if(next)ready.push(next)}
    }
  }
  return {order,cyclic:graph.nodes.filter(node=>!order.includes(node)).map(node=>node.id)}
}

export function validateGraph(graph:GraphDefinition):GraphDiagnostic[]{
  const diagnostics:GraphDiagnostic[]=[],nodes=new Map(graph.nodes.map(node=>[node.id,node])),domain=graph.domain??'signal'
  const supported=new Set(nodeTypesForDomain(domain))
  for(const node of graph.nodes){
    if(!schemaFor(node.type))diagnostics.push({severity:'error',message:`Unknown node type ${node.type}`,nodeId:node.id})
    else if(!supported.has(node.type))diagnostics.push({severity:'error',message:`${schemaFor(node.type)?.label} is not available in the ${domain} domain`,nodeId:node.id})
  }
  for(const edge of graph.edges){
    const from=nodes.get(edge.from),to=nodes.get(edge.to)
    if(!from||!to){diagnostics.push({severity:'error',message:`Edge references a missing node: ${edge.from} → ${edge.to}`,edgeId:edge.id});continue}
    const output=outputsOf(from).find(item=>item.id===(edge.output??'value')),input=inputsOf(to).find(item=>item.id===(edge.input??'value'))
    if(!output){diagnostics.push({severity:'error',message:`${from.type} has no output ${edge.output??'value'}`,edgeId:edge.id});continue}
    if(!input){diagnostics.push({severity:'error',message:`${to.type} has no input ${edge.input??'value'}`,edgeId:edge.id});continue}
    if(!compatible(output.type,input.type,domain))diagnostics.push({severity:'error',message:`Incompatible ports: ${output.type} → ${input.type}`,edgeId:edge.id})
  }
  for(const node of graph.nodes)for(const input of inputsOf(node)){
    const connections=graph.edges.filter(edge=>edge.to===node.id&&(edge.input??'value')===input.id).length
    if(input.required&&!connections)diagnostics.push({severity:'error',message:`${schemaFor(node.type)?.label??node.type}: ${input.label??input.id} must be connected`,nodeId:node.id})
    if(!input.multiple&&connections>1)diagnostics.push({severity:'error',message:`${schemaFor(node.type)?.label??node.type}: ${input.label??input.id} has ${connections} connections but accepts one`,nodeId:node.id})
  }
  for(const id of topologicalOrder(graph).cyclic)diagnostics.push({severity:'error',message:'This node is part of a feedback cycle',nodeId:id})
  for(const node of graph.nodes){
    if((node.type==='write-parameter'||node.type==='parameter')&&!String(fieldValue(node,'id')??''))diagnostics.push({severity:'warning',message:'No parameter selected',nodeId:node.id})
    if(node.type==='scene-object'&&!String(fieldValue(node,'object')??''))diagnostics.push({severity:'warning',message:'No scene object selected',nodeId:node.id})
    if((node.type==='effect-enabled'||node.type==='effect-order'||node.type==='effect-parameter')&&!String(fieldValue(node,'id')??''))diagnostics.push({severity:'warning',message:'No effect selected',nodeId:node.id})
  }
  return diagnostics
}

/** Edges feeding one input port, in authored order. */
export const edgesInto=(graph:GraphDefinition,nodeId:string,inputId:string):GraphEdge[]=>
  graph.edges.filter(edge=>edge.to===nodeId&&(edge.input??'value')===inputId).sort((a,b)=>(a.order??0)-(b.order??0))
