import type { ArtinosRuntime, Unsubscribe } from '@artinos/runtime'
import { gpuExecutor } from './gpu'
import { numericExecutor } from './numeric'
import { renderExecutor } from './render'
import { sceneExecutor } from './scene'
import { nodeTypesForDomain, validateGraph } from './schema'
import type { GraphDefinition, GraphDiagnostic, GraphDomain, GraphDomainExecutor, GraphEvaluation } from './types'

export * from './types'
export * from './schema'
export * from './templates'
export * from './numeric'
export * from './scene'
export * from './gpu'
export * from './render'

export class GraphRegistry{
  revision=0
  private graphs=new Map<string,GraphDefinition>()
  private listeners=new Set<()=>void>()
  upsert(graph:GraphDefinition){this.graphs.set(graph.id,structuredClone(graph));this.bump();return graph.id}
  remove(id:string){const removed=this.graphs.delete(id);if(removed)this.bump();return removed}
  get(id:string){const graph=this.graphs.get(id);return graph?structuredClone(graph):undefined}
  has(id:string){return this.graphs.has(id)}
  list(domain?:GraphDomain){const graphs=[...this.graphs.values()].map(graph=>structuredClone(graph));return domain?graphs.filter(graph=>graph.domain===domain):graphs}
  clear(){if(!this.graphs.size)return;this.graphs.clear();this.bump()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}

interface GraphRun{
  fingerprint:string
  revision?:number
  evaluation:GraphEvaluation
  memory:Map<string,unknown>
  /** Structural warnings, cached so an unchanged graph is not re-validated every frame. */
  warnings:GraphDiagnostic[]
  diagnostics:GraphDiagnostic[]
  error?:string
  errorCount:number
}
/** Structure and authored values, but not node positions — moving a node must not recompile a GPU graph. */
const fingerprint=(graph:GraphDefinition)=>JSON.stringify({
  domain:graph.domain,enabled:graph.enabled,
  nodes:graph.nodes.map(node=>({id:node.id,type:node.type,data:node.data})),
  edges:graph.edges.map(edge=>({from:edge.from,to:edge.to,input:edge.input,output:edge.output,order:edge.order})),
})

export class GraphEngine{
  private runs=new Map<string,GraphRun>()
  private executors=new Map<GraphDomain,GraphDomainExecutor>()
  private lastTime=performance.now()/1000
  private lastDelta=0
  private listRevision=-1
  private cached:GraphDefinition[]=[]
  constructor(private runtime:ArtinosRuntime){
    this.register('signal',numericExecutor)
    this.register('parameter',{...numericExecutor,domain:'parameter'})
    this.register('scene',sceneExecutor)
    this.register('gpu',gpuExecutor)
    this.register('render',renderExecutor)
  }
  register(domain:GraphDomain,executor:GraphDomainExecutor){this.executors.set(domain,executor)}
  nodeTypes(domain:GraphDomain){return this.executors.get(domain)?.nodeTypes??nodeTypesForDomain(domain)}
  diagnostics(graphId:string){return this.runs.get(graphId)?.diagnostics??[]}
  error(graphId:string){return this.runs.get(graphId)?.error}
  last(graphId:string,nodeId:string){return this.runs.get(graphId)?.evaluation.values.get(nodeId)}
  forget(graphId:string){this.runs.delete(graphId)}

  /**
   * Runs every enabled graph for one frame. The registry list is cached by
   * revision because `list()` deep-clones, which is far too costly per frame.
   */
  runAll(registry:GraphRegistry,time=performance.now()/1000){
    if(registry.revision!==this.listRevision){
      this.listRevision=registry.revision
      this.cached=registry.list()
    }
    for(const graph of this.cached)if(graph.enabled!==false)this.evaluate(graph,time,this.listRevision)
  }

  /**
   * Evaluates one graph. `change`-scheduled domains reuse their compiled result
   * until the definition changes and only run the executor's per-frame refresh.
   * A failing graph reports through diagnostics rather than aborting the frame.
   */
  evaluate(graph:GraphDefinition,time=performance.now()/1000,revision?:number):GraphEvaluation|undefined{
    const domain=graph.domain??'signal',executor=this.executors.get(domain)
    // One delta per frame: every graph in the same frame must see the same step.
    if(time!==this.lastTime){this.lastDelta=Math.max(0,Math.min(.25,time-this.lastTime));this.lastTime=time}
    const delta=this.lastDelta
    if(!executor)return this.fail(graph,`No executor for the ${domain} domain`)
    const previous=this.runs.get(graph.id)
    // A known registry revision means the definition cannot have changed, so the
    // fingerprint — a full JSON serialization — is skipped on the frame path.
    const unchanged=Boolean(previous)&&(revision!==undefined&&previous?.revision===revision)
    const print=unchanged?previous?.fingerprint as string:fingerprint(graph)
    const context={runtime:this.runtime,graph,time,delta,memory:previous?.memory??new Map<string,unknown>()}

    if(previous&&previous.fingerprint===print&&executor.schedule==='change'){
      if(previous.error)return undefined
      executor.refresh?.(context)
      return previous.evaluation
    }
    const structural=unchanged&&!previous?.error?[]:validateGraph(graph).filter(item=>item.severity==='error')
    if(structural.length)return this.fail(graph,structural[0].message,print,context.memory,structural,revision)
    // A graph whose definition is unchanged should not keep re-reporting the same throw.
    if(previous&&previous.fingerprint===print&&previous.error&&previous.errorCount>2)return undefined

    try{
      const evaluation=executor.evaluate(context)
      // Structural warnings only change when the definition does, so reuse them per frame.
      const warnings=unchanged&&previous?previous.warnings:validateGraph(graph).filter(item=>item.severity==='warning')
      this.runs.set(graph.id,{fingerprint:print,revision,evaluation,memory:context.memory,warnings,diagnostics:[...warnings,...(evaluation.diagnostics??[])],errorCount:0})
      this.runtime.telemetry.set(`graph.${graph.id}.ms`,evaluation.elapsedMs,{unit:'ms',group:'graph'})
      return evaluation
    }catch(error){
      return this.fail(graph,error instanceof Error?error.message:String(error),print,context.memory,[],revision)
    }
  }

  private fail(graph:GraphDefinition,message:string,print=fingerprint(graph),memory=new Map<string,unknown>(),diagnostics:GraphDiagnostic[]=[],revision?:number){
    const previous=this.runs.get(graph.id)
    const repeated=previous?.fingerprint===print&&previous.error===message
    this.runs.set(graph.id,{
      fingerprint:print,revision,memory,error:message,errorCount:(repeated?previous?.errorCount??0:0)+1,
      warnings:previous?.warnings??[],
      diagnostics:diagnostics.length?diagnostics:[{severity:'error',message}],
      evaluation:previous?.evaluation??{graphId:graph.id,domain:graph.domain??'signal',values:new Map(),elapsedMs:0},
    })
    if(!repeated)this.runtime.logger.warn(`Graph ${graph.name??graph.id} stopped: ${message}`,{source:'graph'})
    return undefined
  }
}
