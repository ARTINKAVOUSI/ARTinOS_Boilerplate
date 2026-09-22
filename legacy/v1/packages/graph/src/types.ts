import type { ArtinosRuntime } from '@artinos/runtime'

export type GraphDomain='scene'|'signal'|'parameter'|'gpu'|'render'
export const MATH_NODE_TYPES=['add','subtract','multiply','divide','min','max','modulo','pow','abs','negate','sign','floor','fract','sqrt','sin','cos'] as const
export const SHAPE_NODE_TYPES=['remap','clamp','smoothstep','mix','noise','oscillator','smooth'] as const
export const NUMERIC_NODE_TYPES=['constant','signal','parameter','time',...MATH_NODE_TYPES,...SHAPE_NODE_TYPES,'condition','write-parameter','write-signal'] as const
export const SCENE_NODE_TYPES=['scene-object','transform','visible','material-parameter'] as const
export const GPU_NODE_TYPES=['constant','uniform','signal','parameter','time','uv','add','subtract','multiply','divide','min','max','pow','abs','sin','cos','remap','clamp','smoothstep','mix','output'] as const
export const RENDER_NODE_TYPES=['effect-enabled','effect-order','effect-parameter'] as const
export const GRAPH_NODE_TYPES=[...new Set([...NUMERIC_NODE_TYPES,...SCENE_NODE_TYPES,...GPU_NODE_TYPES,...RENDER_NODE_TYPES])] as const
export type GraphNodeType=(typeof GRAPH_NODE_TYPES)[number]
export type GraphValueType='number'|'boolean'|'vector'|'color'|'object'|'texture'|'node'|'any'
export interface GraphPort{id:string;label?:string;type:GraphValueType;multiple?:boolean;required?:boolean}
export interface GraphNode{id:string;type:GraphNodeType;label?:string;x?:number;y?:number;data?:Record<string,unknown>;inputs?:GraphPort[];outputs?:GraphPort[]}
export interface GraphEdge{id?:string;from:string;to:string;output?:string;input?:string;order?:number}
/** A named subgraph: a set of member nodes that can be collapsed to one box. */
export interface GraphGroup{id:string;label:string;nodes:string[];collapsed?:boolean;color?:string}
export interface GraphDefinition{id:string;name?:string;domain?:GraphDomain;nodes:GraphNode[];edges:GraphEdge[];enabled?:boolean;groups?:GraphGroup[]}
export interface GraphExecutionContext{runtime:ArtinosRuntime;graph:GraphDefinition;time:number;delta:number;memory:Map<string,unknown>}
export interface GraphEvaluation<T=unknown>{graphId:string;domain:GraphDomain;values:Map<string,T>;elapsedMs:number;diagnostics?:GraphDiagnostic[]}
/** `frame` graphs run every frame; `change` graphs re-run only when the definition changes. */
export type GraphSchedule='frame'|'change'
export interface GraphDomainExecutor<T=unknown>{
  domain:GraphDomain
  nodeTypes:readonly GraphNodeType[]
  schedule?:GraphSchedule
  evaluate(context:GraphExecutionContext):GraphEvaluation<T>
  /** Per-frame work for `change` graphs, such as pushing uniform values into an already compiled node graph. */
  refresh?(context:GraphExecutionContext):void
}
export interface GraphDiagnostic{severity:'error'|'warning';message:string;nodeId?:string;edgeId?:string}
