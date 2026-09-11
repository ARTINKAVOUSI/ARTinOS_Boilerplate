import { edgesInto, fieldValue, inputsOf, topologicalOrder } from './schema'
import { NUMERIC_NODE_TYPES, type GraphDomainExecutor, type GraphEvaluation, type GraphExecutionContext, type GraphNode } from './types'

const NUMERIC=new Set<string>(NUMERIC_NODE_TYPES)
export const isNumericNode=(node:GraphNode)=>NUMERIC.has(node.type)
const hashNoise=(x:number)=>{const s=Math.sin(x*12.9898)*43758.5453123;return(s-Math.floor(s))*2-1}
const finite=(value:number)=>Number.isFinite(value)?value:0

/**
 * Evaluates every numeric node in dependency order and returns their values.
 * Scene and render graphs reuse this so their nodes can be driven by live signals.
 */
export function evaluateNumeric(context:GraphExecutionContext):Map<string,number>{
  const {runtime,graph,time,delta,memory}=context,values=new Map<string,number>()
  const wired=(node:GraphNode,portId:string):number[]=>edgesInto(graph,node.id,portId).map(edge=>values.get(edge.from)).filter((value):value is number=>value!==undefined)
  /** A connected port wins; otherwise the node's own field is the literal. */
  const read=(node:GraphNode,portId:string,fieldId=portId,fallback=0):number=>{
    const connected=wired(node,portId)
    if(connected.length)return connected[0]
    const field=fieldValue(node,fieldId)
    return field===undefined?fallback:finite(Number(field))
  }
  const list=(node:GraphNode,portId:string):number[]=>{
    const connected=wired(node,portId)
    // Legacy graphs authored before ports carried ids fed every edge positionally.
    return connected.length?connected:graph.edges.filter(edge=>edge.to===node.id&&edge.input===undefined).sort((a,b)=>(a.order??0)-(b.order??0)).map(edge=>values.get(edge.from)??0)
  }
  const field=(node:GraphNode,id:string,fallback:number)=>{const value=fieldValue(node,id);return value===undefined?fallback:finite(Number(value))}

  for(const node of topologicalOrder(graph).order){
    if(!isNumericNode(node))continue
    let output=0
    switch(node.type){
      case'constant':output=field(node,'value',0);break
      case'signal':output=finite(Number(runtime.signals.get(String(fieldValue(node,'id')??''))??0));break
      case'parameter':output=finite(Number(runtime.parameters.get(String(fieldValue(node,'id')??''))??0));break
      case'time':output=time*field(node,'speed',1)+field(node,'offset',0);break
      case'add':output=list(node,'values').reduce((a,b)=>a+b,0);break
      case'multiply':{const items=list(node,'values');output=items.length?items.reduce((a,b)=>a*b,1):0;break}
      case'min':{const items=list(node,'values');output=items.length?Math.min(...items):0;break}
      case'max':{const items=list(node,'values');output=items.length?Math.max(...items):0;break}
      case'subtract':output=read(node,'a')-read(node,'b');break
      case'divide':{const b=read(node,'b','b',1);output=b===0?read(node,'a'):read(node,'a')/b;break}
      case'modulo':{const b=read(node,'b','b',1);output=b===0?0:read(node,'a')%b;break}
      case'pow':output=Math.pow(read(node,'a'),read(node,'b','power',2));break
      case'abs':output=Math.abs(read(node,'value'));break
      case'negate':output=-read(node,'value');break
      case'sign':output=Math.sign(read(node,'value'));break
      case'floor':output=Math.floor(read(node,'value'));break
      case'fract':{const x=read(node,'value');output=x-Math.floor(x);break}
      case'sqrt':output=Math.sqrt(Math.max(0,read(node,'value')));break
      case'sin':output=Math.sin(read(node,'value'));break
      case'cos':output=Math.cos(read(node,'value'));break
      case'remap':{const x=read(node,'value'),min=field(node,'inMin',0),max=field(node,'inMax',1),outMin=field(node,'outMin',0)
        output=outMin+((x-min)/((max-min)||1))*(field(node,'outMax',1)-outMin);break}
      case'clamp':output=Math.max(field(node,'min',0),Math.min(field(node,'max',1),read(node,'value')));break
      case'smoothstep':{const min=field(node,'min',0),max=field(node,'max',1)
        const t=Math.max(0,Math.min(1,(read(node,'value')-min)/((max-min)||1)));output=t*t*(3-2*t);break}
      case'mix':{const t=read(node,'t','t',.5);output=read(node,'a')*(1-t)+read(node,'b')*t;break}
      case'noise':{const connected=wired(node,'value')
        output=hashNoise((connected.length?connected[0]:time)*field(node,'frequency',1)+field(node,'seed',0));break}
      case'oscillator':{
        const frequency=read(node,'frequency','frequency',1),phase=(time*frequency+field(node,'phase',0))%1
        const wave=String(fieldValue(node,'wave')??'sine')
        const shape=wave==='saw'?phase*2-1:wave==='square'?(phase<.5?1:-1):wave==='triangle'?1-Math.abs(phase*4-2):Math.sin(phase*Math.PI*2)
        output=shape*field(node,'amplitude',1)+field(node,'offset',0);break}
      case'smooth':{
        const target=read(node,'value'),amount=Math.max(0,Math.min(.999,field(node,'amount',.85))),key=`smooth:${node.id}`
        const previous=memory.get(key)
        // Exponential decay against real elapsed time so the result does not change with frame rate.
        const alpha=amount<=0?1:1-Math.pow(amount,Math.max(delta,1/240)*60)
        output=typeof previous==='number'?previous+(target-previous)*alpha:target
        memory.set(key,output);break}
      case'condition':{
        const value=read(node,'value'),threshold=field(node,'threshold',.5),comparison=String(fieldValue(node,'comparison')??'>')
        const passes=comparison==='>='?value>=threshold:comparison==='<'?value<threshold:comparison==='<='?value<=threshold:value>threshold
        output=passes?read(node,'yes','yes',1):read(node,'no','no',0);break}
      case'write-parameter':{
        output=read(node,'value')
        const id=String(fieldValue(node,'id')??'')
        if(id&&runtime.parameters.state(id))runtime.parameters.setResolved(id,output)
        break}
      case'write-signal':{
        output=read(node,'value')
        const id=String(fieldValue(node,'id')??'')
        if(id)runtime.signals.set(id,output,{source:`graph:${graph.id}`})
        break}
      default:continue
    }
    values.set(node.id,finite(output))
  }
  return values
}

/** True when the node has an unconnected required input, so downstream writes should be skipped. */
export const isStarved=(context:GraphExecutionContext,node:GraphNode)=>
  inputsOf(node).some(port=>port.required&&!edgesInto(context.graph,node.id,port.id).length)

export const numericExecutor:GraphDomainExecutor<number>={domain:'signal',nodeTypes:NUMERIC_NODE_TYPES,schedule:'frame',
  evaluate(context){
    const started=performance.now(),values=evaluateNumeric(context)
    return {graphId:context.graph.id,domain:context.graph.domain??'signal',values,elapsedMs:performance.now()-started} as GraphEvaluation<number>
  }}
