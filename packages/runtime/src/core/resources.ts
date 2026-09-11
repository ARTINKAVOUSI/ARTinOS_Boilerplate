import type { Unsubscribe } from './types'
export interface ResourceRecord<T=unknown>{id:string;resource:T;kind?:string;owner?:string;createdAt:number;metadata?:Record<string,unknown>}
export class ResourceRegistry{
  revision=0;private resources=new Map<string,ResourceRecord>();private listeners=new Set<()=>void>()
  set<T>(id:string,resource:T,options:{kind?:string;owner?:string;metadata?:Record<string,unknown>}={}):Unsubscribe{const record:ResourceRecord<T>={id,resource,createdAt:performance.now(),...options};this.resources.set(id,record);this.emit();return()=>{if(this.resources.get(id)===record){this.resources.delete(id);this.emit()}}}
  get<T=unknown>(id:string):T|undefined{return this.resources.get(id)?.resource as T|undefined} record(id:string){return this.resources.get(id)} list():ResourceRecord[]{return[...this.resources.values()]}
  delete(id:string,dispose=false){const record=this.resources.get(id);if(!record)return false;if(dispose){try{(record.resource as any)?.dispose?.()}catch{}}this.resources.delete(id);this.emit();return true}
  disposeOwner(owner:string){for(const[id,record]of [...this.resources])if(record.owner===owner){const r:any=record.resource;try{r?.dispose?.()}catch{}this.resources.delete(id)}this.emit()}
  clear(dispose=false){if(dispose)for(const record of this.resources.values()){try{(record.resource as any)?.dispose?.()}catch{}}this.resources.clear();this.emit()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)} private emit(){this.revision++;this.listeners.forEach(fn=>fn())}
}
