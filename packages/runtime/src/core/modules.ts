import type { ArtinosRuntime } from './runtime'
import type { ParameterDefinition, ParameterValue, Unsubscribe } from './types'
export type ModuleRuntime='r3f'|'headless'
export type ModuleProvider='artinos'|'drei'|'three-stdlib'|'three'|'project'
export type ModulePortType='number'|'boolean'|'string'|'vec2'|'vec3'|'vec4'|'signal'|'resource'|'event'
export interface ModulePort { id:string; type:ModulePortType; label?:string; optional?:boolean; description?:string }
export interface ModuleResourceContract { id:string; kind:string; required?:boolean; description?:string }
export interface ModuleTelemetryContract { id:string; group:string; unit?:string; description?:string }
export interface ModuleQualityContract { consumerId:string; description?:string }
export interface ModulePresetContract { group:string; ids?:string[]; description?:string }
export interface ModuleSerializationContract { version:number; persistedParameters?:string[] }
export interface ModuleComponentContract { import:string; export:string }
export interface ModuleHeadlessContract { install(runtime:ArtinosRuntime):Unsubscribe|void }
export interface ModuleManifest{
  id:string;name:string;category:string;description:string;runtime:ModuleRuntime;provider:ModuleProvider;version:string;tags?:string[];parameters?:ParameterDefinition[];capabilities?:string[];dependencies?:string[];canonicalImport?:string;agentNotes?:string
  inputs?:ModulePort[];outputs?:ModulePort[];resources?:ModuleResourceContract[];telemetry?:ModuleTelemetryContract[];quality?:ModuleQualityContract[];presets?:ModulePresetContract[];component?:ModuleComponentContract;headless?:ModuleHeadlessContract;serialization?:ModuleSerializationContract;agent?:Record<string,ParameterValue>
}
export class ModuleRegistry{
  revision=0;private values=new Map<string,ModuleManifest>();private listeners=new Set<()=>void>()
  private validate(m:ModuleManifest){if(!m.id.trim())throw new Error('Module id is required');for(const ports of [m.inputs,m.outputs]){const ids=new Set<string>();for(const port of ports??[]){if(ids.has(port.id))throw new Error(`Module ${m.id} has duplicate port ${port.id}`);ids.add(port.id)}}}
  register(m:ModuleManifest):Unsubscribe{this.validate(m);if(this.values.has(m.id))throw new Error(`Module ${m.id} is already registered`);this.values.set(m.id,m);this.bump();return()=>{if(this.values.get(m.id)===m){this.values.delete(m.id);this.bump()}}}
  upsert(m:ModuleManifest){this.validate(m);this.values.set(m.id,m);this.bump()}
  get(id:string){return this.values.get(id)} list(){return [...this.values.values()].sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name))}
  search(q:string){const s=q.toLowerCase();return this.list().filter(m=>`${m.id} ${m.name} ${m.category} ${m.tags?.join(' ')??''}`.toLowerCase().includes(s))}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)} private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}
