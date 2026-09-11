import type { ArtinosRuntime, Unsubscribe } from '@artinos/runtime'
export interface RecordedSignal { time:number; id:string; value:unknown; metadata?:Record<string,unknown> }
export interface SignalRecording { version:1; createdAt:number; duration:number; samples:RecordedSignal[] }
export class SignalRecorder {
  revision=0; private listeners=new Set<()=>void>(); private unsubscribe:Unsubscribe|null=null; private started=0; private samples:RecordedSignal[]=[]; private replayStop:Unsubscribe|null=null
  constructor(private runtime:ArtinosRuntime,private maxSamples=100000){}
  subscribe=(fn:()=>void):Unsubscribe=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
  isRecording(){return this.unsubscribe!==null}
  isReplaying(){return this.replayStop!==null}
  start(prefixes:string[]=[]){if(this.unsubscribe)return;this.samples=[];this.started=performance.now();this.unsubscribe=this.runtime.signals.subscribeAll(sample=>{if(prefixes.length&&!prefixes.some(p=>sample.id.startsWith(p)))return;if(this.samples.length>=this.maxSamples)this.samples.shift();this.samples.push({time:(sample.timestamp-this.started)/1000,id:sample.id,value:structuredCloneSafe(sample.value),metadata:sample.metadata})});this.bump();this.runtime.logger.info('Signal recording started',{source:'input-recorder'})}
  stop():SignalRecording{this.unsubscribe?.();this.unsubscribe=null;const recording=this.snapshot();this.bump();this.runtime.logger.info(`Signal recording stopped (${recording.samples.length} samples)`,{source:'input-recorder'});return recording}
  clear(){this.unsubscribe?.();this.unsubscribe=null;this.stopReplay();this.samples=[];this.started=0;this.bump()}
  snapshot():SignalRecording{const duration=this.samples.length?this.samples[this.samples.length-1].time:0;return{version:1,createdAt:Date.now(),duration,samples:[...this.samples]}}
  export(){return JSON.stringify(this.snapshot(),null,2)}
  import(raw:string|SignalRecording){const recording=typeof raw==='string'?JSON.parse(raw):raw;if(recording?.version!==1||!Array.isArray(recording.samples))throw new Error('Unsupported ARTINOS signal recording');this.samples=recording.samples;this.bump();return this.snapshot()}
  play(recording=this.snapshot(),{speed=1,loop=false}:{speed?:number;loop?:boolean}={}){this.stopReplay();if(!recording.samples.length)return()=>{};let cursor=0,elapsed=0;const duration=Math.max(.0001,recording.duration);const stop=this.runtime.frames.add({id:'input.recording-replay',phase:'input',priority:-500,run:({delta})=>{elapsed+=delta*Math.max(.01,speed);while(cursor<recording.samples.length&&recording.samples[cursor].time<=elapsed){const s=recording.samples[cursor++];this.runtime.signals.set(s.id,s.value,{...(s.metadata??{}),replay:true})}if(cursor>=recording.samples.length&&loop){elapsed%=duration;cursor=0}else if(cursor>=recording.samples.length)this.stopReplay()}});this.replayStop=()=>{stop();this.replayStop=null;this.bump()};this.bump();return()=>this.stopReplay()}
  stopReplay(){this.replayStop?.()}
}
const structuredCloneSafe=(value:unknown)=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value))}catch{return value}}
