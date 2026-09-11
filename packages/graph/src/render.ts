import type { PostFXController } from '@artinos/runtime'
import { evaluateNumeric, isNumericNode } from './numeric'
import { edgesInto, fieldValue, topologicalOrder } from './schema'
import { RENDER_NODE_TYPES, NUMERIC_NODE_TYPES, type GraphDiagnostic, type GraphDomainExecutor, type GraphNode } from './types'

export const renderExecutor:GraphDomainExecutor<unknown>={domain:'render',nodeTypes:[...RENDER_NODE_TYPES,...NUMERIC_NODE_TYPES],schedule:'frame',
  evaluate(context){
    const started=performance.now(),{runtime,graph}=context,values=new Map<string,unknown>(),diagnostics:GraphDiagnostic[]=[]
    const controller=runtime.resources.get<PostFXController>('postfx.controller')
    if(!controller)return {graphId:graph.id,domain:'render',values,elapsedMs:0,diagnostics:[{severity:'warning',message:'Waiting for the PostFX pipeline'}]}
    const numbers=evaluateNumeric(context)
    for(const [id,value] of numbers)values.set(id,value)
    const driven=(node:GraphNode)=>{const edge=edgesInto(graph,node.id,'value')[0];return edge?numbers.get(edge.from):undefined}
    const snapshot=controller.snapshot()

    for(const node of topologicalOrder(graph).order){
      if(isNumericNode(node))continue
      const id=String(fieldValue(node,'id')??'')
      const effect=snapshot.find(item=>item.id===id)
      if(!effect){diagnostics.push({severity:'warning',message:`PostFX effect "${id||'—'}" is not in the pipeline`,nodeId:node.id});continue}
      // Effects are rendered from their `postfx.<type>.<key>` parameters, so the
      // parameter is the owner. Writing the controller directly is reverted the
      // next time that tree renders; write the resolved parameter instead and
      // fall back to the controller only for effects with no registered parameter.
      const writeOwned=(key:string,value:number|boolean)=>{
        const parameterId=`postfx.${effect.type}.${key}`
        if(runtime.parameters.state(parameterId)){runtime.parameters.setResolved(parameterId,value);return true}
        return false
      }
      if(node.type==='effect-enabled'){
        const connected=driven(node)
        const enabled=connected===undefined?Boolean(fieldValue(node,'enabled')):connected>.5
        if(!writeOwned('enabled',enabled)&&effect.enabled!==enabled)controller.setEffectEnabled(id,enabled)
        values.set(node.id,enabled)
      }else if(node.type==='effect-order'){
        const order=Number(fieldValue(node,'order')??0)
        if(!writeOwned('order',order)&&effect.order!==order)controller.move(id,order)
        values.set(node.id,order)
      }else if(node.type==='effect-parameter'){
        const parameter=String(fieldValue(node,'parameter')??'')
        if(!parameter){diagnostics.push({severity:'warning',message:'No effect parameter selected',nodeId:node.id});continue}
        const next=driven(node)??Number(fieldValue(node,'value')??0)
        // The controller rebuilds the pipeline on change, so only write real deltas.
        if(!writeOwned(parameter,next)&&effect.params?.[parameter]!==next)controller.update(id,{params:{...effect.params,[parameter]:next}})
        values.set(node.id,next)
      }
    }
    return {graphId:graph.id,domain:'render',values,elapsedMs:performance.now()-started,diagnostics}
  }}
