import type { Unsubscribe } from './types'
export type LogLevel='debug'|'info'|'warn'|'error'
export interface RuntimeLog { id:number; level:LogLevel; message:string; timestamp:number; source?:string; data?:unknown }
export class RuntimeLogger{
  revision=0;private seq=0;private logs:RuntimeLog[]=[];private listeners=new Set<()=>void>()
  constructor(private limit=300){}
  log(level:LogLevel,message:string,options:{source?:string;data?:unknown}={}){this.logs.push({id:++this.seq,level,message,timestamp:performance.now(),...options});if(this.logs.length>this.limit)this.logs.splice(0,this.logs.length-this.limit);this.revision++;this.listeners.forEach(fn=>fn())}
  debug(m:string,o?:{source?:string;data?:unknown}){this.log('debug',m,o)} info(m:string,o?:{source?:string;data?:unknown}){this.log('info',m,o)} warn(m:string,o?:{source?:string;data?:unknown}){this.log('warn',m,o)} error(m:string,o?:{source?:string;data?:unknown}){this.log('error',m,o)}
  list(level?:LogLevel){return level?this.logs.filter(l=>l.level===level):[...this.logs]}
  clear(){this.logs=[];this.revision++;this.listeners.forEach(fn=>fn())}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
}
