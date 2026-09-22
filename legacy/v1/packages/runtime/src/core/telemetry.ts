import type { Unsubscribe } from './types'
export interface TelemetryMetric{id:string;value:number|string|boolean;timestamp:number;unit?:string;group?:string;metadata?:Record<string,unknown>}
export interface TelemetrySample{ id:string;value:TelemetryMetric['value'];options?:Pick<TelemetryMetric,'unit'|'group'|'metadata'> }
export class TelemetryBus{
  revision=0;private metrics=new Map<string,TelemetryMetric>();private listeners=new Set<()=>void>();private histories=new Map<string,number[]>();constructor(private historyLimit=180){}
  set(id:string,value:TelemetryMetric['value'],options:Pick<TelemetryMetric,'unit'|'group'|'metadata'>={}){this.setMany([{id,value,options}])}
  setMany(samples:TelemetrySample[]){if(!samples.length)return;const timestamp=performance.now();for(const{ id,value,options={} }of samples){this.metrics.set(id,{id,value,timestamp,...options});if(typeof value==='number'&&Number.isFinite(value)){const history=this.histories.get(id)??[];history.push(value);if(history.length>this.historyLimit)history.splice(0,history.length-this.historyLimit);this.histories.set(id,history)}}this.emit()}
  increment(id:string,amount=1){const v=this.metrics.get(id)?.value;this.set(id,(typeof v==='number'?v:0)+amount)}
  get(id:string){return this.metrics.get(id)} list(group?:string){const a=[...this.metrics.values()];return group?a.filter(m=>m.group===group):a}
  history(id:string){return [...(this.histories.get(id)??[])]} clearHistory(id?:string){if(id)this.histories.delete(id);else this.histories.clear();this.emit()} clear(){this.metrics.clear();this.histories.clear();this.emit()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private emit(){this.revision++;this.listeners.forEach(fn=>fn())}
}
