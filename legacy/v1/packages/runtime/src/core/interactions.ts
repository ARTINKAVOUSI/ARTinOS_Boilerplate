import type { SignalRegistry } from './signals'
import type { Unsubscribe } from './types'

export interface CommandContext { source?:string; value?:unknown; timestamp:number; metadata?:Record<string,unknown> }
export interface CommandDefinition { id:string; label?:string; description?:string; execute(context:CommandContext):void|Promise<void> }
export interface ActionDefinition { id:string; label?:string; command:string; source:string; condition?:'change'|'rise'|'fall'|'above'|'below'; threshold?:number; cooldownMs?:number; enabled?:boolean; mapValue?(value:unknown):unknown }

export class CommandRegistry {
  revision=0
  private commands=new Map<string,CommandDefinition>()
  private listeners=new Set<()=>void>()
  register(command:CommandDefinition):Unsubscribe{this.commands.set(command.id,command);this.bump();return()=>this.remove(command.id)}
  remove(id:string){const removed=this.commands.delete(id);if(removed)this.bump();return removed}
  list(){return[...this.commands.values()]}
  get(id:string){return this.commands.get(id)}
  async execute(id:string,context:Partial<CommandContext>={}){const command=this.commands.get(id);if(!command)throw new Error(`Command ${id} is not registered`);return command.execute({timestamp:performance.now(),...context})}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}

export class ActionRegistry {
  revision=0
  private actions=new Map<string,ActionDefinition>()
  private unsubs=new Map<string,Unsubscribe>()
  private lastRun=new Map<string,number>()
  private listeners=new Set<()=>void>()
  constructor(private signals:SignalRegistry,private commands:CommandRegistry){}
  add(action:ActionDefinition):Unsubscribe{this.remove(action.id);this.actions.set(action.id,action);let previous:unknown=this.signals.get(action.source);const unsub=this.signals.subscribe(action.source,sample=>{const current=sample.value,condition=action.condition??'change',threshold=action.threshold??.5,now=performance.now(),last=this.lastRun.get(action.id)??-Infinity;let fire=condition==='change'&&current!==previous;if(typeof current==='number'){const before=typeof previous==='number'?previous:current;fire=condition==='rise'?before<threshold&&current>=threshold:condition==='fall'?before>threshold&&current<=threshold:condition==='above'?current>threshold:condition==='below'?current<threshold:fire}previous=current;if(action.enabled===false||!fire||now-last<(action.cooldownMs??0))return;this.lastRun.set(action.id,now);void this.commands.execute(action.command,{source:action.source,value:action.mapValue?.(current)??current,metadata:sample.metadata})});this.unsubs.set(action.id,unsub);this.bump();return()=>this.remove(action.id)}
  remove(id:string){this.unsubs.get(id)?.();this.unsubs.delete(id);const removed=this.actions.delete(id);if(removed)this.bump();return removed}
  list(){return[...this.actions.values()]}
  clear(){for(const unsub of this.unsubs.values())unsub();this.unsubs.clear();this.actions.clear();this.bump()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}

export type SignalOperator =
  | {type:'scale';amount:number}
  | {type:'offset';amount:number}
  | {type:'clamp';min:number;max:number}
  | {type:'deadzone';amount:number}
  | {type:'smooth';amount:number}
  | {type:'curve';power:number}
  | {type:'invert';min?:number;max?:number}

export interface SignalPipelineDefinition { id:string; source:string; target:string; operators:SignalOperator[]; enabled?:boolean }
export class SignalProcessor {
  revision=0
  private pipelines=new Map<string,SignalPipelineDefinition>()
  private unsubs=new Map<string,Unsubscribe>()
  private memory=new Map<string,number>()
  constructor(private signals:SignalRegistry){}
  add(definition:SignalPipelineDefinition):Unsubscribe{
    this.remove(definition.id)
    this.pipelines.set(definition.id,structuredClone(definition))
    const unsub=this.signals.subscribe(definition.source,sample=>{
      if(definition.enabled===false||typeof sample.value!=='number')return
      let value=sample.value
      for(const operator of definition.operators){
        if(operator.type==='scale')value*=operator.amount
        else if(operator.type==='offset')value+=operator.amount
        else if(operator.type==='clamp')value=Math.max(operator.min,Math.min(operator.max,value))
        else if(operator.type==='deadzone')value=Math.abs(value)<operator.amount?0:value
        else if(operator.type==='curve')value=Math.sign(value)*Math.pow(Math.abs(value),Math.max(.01,operator.power))
        else if(operator.type==='invert')value=(operator.max??1)+(operator.min??0)-value
        else if(operator.type==='smooth'){const before=this.memory.get(definition.id)??value;value=before+(value-before)*Math.max(0,Math.min(1,operator.amount))}
      }
      this.memory.set(definition.id,value)
      this.signals.set(definition.target,value,{pipeline:definition.id,source:definition.source})
    })
    this.unsubs.set(definition.id,unsub)
    this.revision++
    return()=>this.remove(definition.id)
  }
  remove(id:string){this.unsubs.get(id)?.();this.unsubs.delete(id);this.memory.delete(id);const removed=this.pipelines.delete(id);if(removed)this.revision++;return removed}
  list(){return[...this.pipelines.values()].map(item=>structuredClone(item))}
  clear(){for(const unsub of this.unsubs.values())unsub();this.unsubs.clear();this.pipelines.clear();this.memory.clear();this.revision++}
}

export class ProjectState {
  revision=0
  private values=new Map<string,unknown>()
  private listeners=new Set<()=>void>()
  set<T>(id:string,value:T){this.values.set(id,structuredClone(value));this.bump();return value}
  get<T>(id:string):T|undefined{const value=this.values.get(id);return value===undefined?undefined:structuredClone(value) as T}
  remove(id:string){const removed=this.values.delete(id);if(removed)this.bump();return removed}
  snapshot(){return Object.fromEntries([...this.values].map(([id,value])=>[id,structuredClone(value)]))}
  restore(values:Record<string,unknown>={}){this.values=new Map(Object.entries(structuredClone(values)));this.bump()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}
