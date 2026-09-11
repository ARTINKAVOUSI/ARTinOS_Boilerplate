import * as TSL from 'three/tsl'
import { edgesInto, fieldValue, topologicalOrder } from './schema'
import { GPU_NODE_TYPES, type GraphDiagnostic, type GraphDomainExecutor, type GraphNode } from './types'

const api=TSL as unknown as Record<string,(...args:any[])=>any>
interface UniformBinding{uniform:any;kind:'signal'|'parameter';id:string}
const BINDINGS='gpu:uniforms'

/**
 * GPU graphs compile to real TSL nodes. Compilation happens when the definition
 * changes; every frame only pushes uniform values, because rebuilding a node
 * graph per frame forces a pipeline recompile and stalls the renderer.
 */
export const gpuExecutor:GraphDomainExecutor<unknown>={domain:'gpu',nodeTypes:GPU_NODE_TYPES,schedule:'change',
  evaluate(context){
    const started=performance.now(),{runtime,graph,memory}=context,values=new Map<string,any>(),diagnostics:GraphDiagnostic[]=[]
    const bindings:UniformBinding[]=[]
    memory.set(BINDINGS,bindings)
    runtime.resources.disposeOwner(`graph:${graph.id}`)
    const port=(node:GraphNode,portId:string)=>{const edge=edgesInto(graph,node.id,portId)[0];return edge?values.get(edge.from):undefined}
    const many=(node:GraphNode,portId:string)=>edgesInto(graph,node.id,portId).map(edge=>values.get(edge.from)).filter(value=>value!=null)
    const literal=(node:GraphNode,id:string,fallback:number)=>{const value=fieldValue(node,id);return value===undefined?fallback:Number(value)||0}
    /** A connected wire wins; otherwise the field becomes a constant node. */
    const operand=(node:GraphNode,portId:string,fieldId:string,fallback:number)=>port(node,portId)??api.float(literal(node,fieldId,fallback))
    const reduce=(node:GraphNode,method:'add'|'mul'|'min'|'max',identity:number)=>{
      const items=many(node,'values')
      if(!items.length)return api.float(identity)
      return items.slice(1).reduce((carry,item)=>carry[method](item),items[0])
    }

    for(const node of topologicalOrder(graph).order){
      let value:any
      switch(node.type){
        case'constant':value=api.float(literal(node,'value',0));break
        case'uniform':value=api.uniform(literal(node,'value',1));break
        case'signal':case'parameter':{
          const id=String(fieldValue(node,'id')??'')
          const seed=node.type==='signal'?Number(runtime.signals.get(id)??0):Number(runtime.parameters.get(id)??0)
          const uniform=api.uniform(Number.isFinite(seed)?seed:0)
          if(id)bindings.push({uniform,kind:node.type,id})
          else diagnostics.push({severity:'warning',message:`No ${node.type} selected`,nodeId:node.id})
          value=uniform;break}
        case'time':value=(TSL as any).time;break
        case'uv':value=api.uv();break
        case'add':value=reduce(node,'add',0);break
        case'multiply':value=reduce(node,'mul',1);break
        case'min':value=reduce(node,'min',0);break
        case'max':value=reduce(node,'max',0);break
        case'subtract':value=operand(node,'a','a',0).sub(operand(node,'b','b',0));break
        case'divide':value=operand(node,'a','a',0).div(operand(node,'b','b',1));break
        case'pow':value=operand(node,'a','a',0).pow(operand(node,'b','power',2));break
        case'abs':value=api.abs(operand(node,'value','value',0));break
        case'sin':value=api.sin(operand(node,'value','value',0));break
        case'cos':value=api.cos(operand(node,'value','value',0));break
        case'clamp':value=api.clamp(operand(node,'value','value',0),literal(node,'min',0),literal(node,'max',1));break
        case'smoothstep':value=api.smoothstep(literal(node,'min',0),literal(node,'max',1),operand(node,'value','value',0));break
        case'mix':value=api.mix(operand(node,'a','a',0),operand(node,'b','b',1),operand(node,'t','t',.5));break
        case'remap':value=api.remap(operand(node,'value','value',0),literal(node,'inMin',0),literal(node,'inMax',1),literal(node,'outMin',0),literal(node,'outMax',1));break
        case'output':{
          const source=port(node,'value')
          if(!source){diagnostics.push({severity:'error',message:'TSL Output has nothing connected',nodeId:node.id});continue}
          value=source
          runtime.resources.set(`graph.${graph.id}.tsl`,source,{kind:'tsl-node',owner:`graph:${graph.id}`,metadata:{target:String(fieldValue(node,'target')??'resource')}})
          break}
        default:diagnostics.push({severity:'error',message:`GPU graphs do not support ${node.type}`,nodeId:node.id});continue
      }
      if(value==null){diagnostics.push({severity:'error',message:'This node has no resolvable input',nodeId:node.id});continue}
      values.set(node.id,value)
    }
    return {graphId:graph.id,domain:'gpu',values,elapsedMs:performance.now()-started,diagnostics}
  },
  refresh({runtime,memory}){
    const bindings=memory.get(BINDINGS) as UniformBinding[]|undefined
    if(!bindings?.length)return
    for(const binding of bindings){
      const raw=binding.kind==='signal'?runtime.signals.get(binding.id):runtime.parameters.get(binding.id)
      const next=Number(raw??0)
      if(Number.isFinite(next))binding.uniform.value=next
    }
  }}
