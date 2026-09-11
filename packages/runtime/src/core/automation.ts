import type { ParameterRegistry } from './parameters'
import type { Unsubscribe } from './types'

export type EasingName='linear'|'smooth'|'ease-in'|'ease-out'|'ease-in-out'|'cubic-in-out'|'back'|'bounce'|'spring'
export interface Keyframe{time:number;value:number;easing?:EasingName}
export interface AutomationTrack{id:string;target:string;keyframes:Keyframe[];duration:number;loop?:boolean;enabled?:boolean;offset?:number;speed?:number;priority?:number}

export class AutomationEngine{
  revision=0;private tracks=new Map<string,AutomationTrack>();private listeners=new Set<()=>void>()
  constructor(private parameters:ParameterRegistry){}
  add(track:AutomationTrack):Unsubscribe{this.remove(track.id);this.tracks.set(track.id,{...track,keyframes:[...track.keyframes].sort((a,b)=>a.time-b.time)});this.bump();return()=>this.remove(track.id)}
  remove(id:string){const track=this.tracks.get(id),ok=this.tracks.delete(id);if(track)this.parameters.removeContribution(track.target,`automation:${id}`);if(ok)this.bump();return ok}
  list(){return[...this.tracks.values()]}
  evaluate(time:number){for(const track of this.tracks.values()){if(track.enabled===false||track.keyframes.length===0){this.parameters.removeContribution(track.target,`automation:${track.id}`);continue}let t=time*(track.speed??1)+(track.offset??0);if(track.loop&&track.duration>0)t=((t%track.duration)+track.duration)%track.duration;else t=Math.max(0,Math.min(track.duration,t));const frames=track.keyframes;let a=frames[0],b=frames[frames.length-1];for(let i=0;i<frames.length-1;i++)if(t>=frames[i].time&&t<=frames[i+1].time){a=frames[i];b=frames[i+1];break}const u=a===b?0:(t-a.time)/(b.time-a.time||1),e=ease(u,b.easing??a.easing??'linear'),value=a.value+(b.value-a.value)*e;this.parameters.setContribution(track.target,`automation:${track.id}`,value,{mode:'replace',priority:track.priority??100,source:'automation',metadata:{track:track.id}})}}
  clear(){if(!this.tracks.size)return;for(const track of this.tracks.values())this.parameters.removeContribution(track.target,`automation:${track.id}`);this.tracks.clear();this.bump()}
  subscribe(fn:()=>void):Unsubscribe{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}

export function ease(t:number,type:EasingName='linear'){
  const x=Math.max(0,Math.min(1,t))
  if(type==='smooth')return x*x*(3-2*x)
  if(type==='ease-in')return x*x
  if(type==='ease-out')return 1-(1-x)*(1-x)
  if(type==='ease-in-out')return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2
  if(type==='cubic-in-out')return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2
  if(type==='back'){const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)}
  if(type==='bounce'){const n1=7.5625,d1=2.75;if(x<1/d1)return n1*x*x;if(x<2/d1){const y=x-1.5/d1;return n1*y*y+.75}if(x<2.5/d1){const y=x-2.25/d1;return n1*y*y+.9375}const y=x-2.625/d1;return n1*y*y+.984375}
  if(type==='spring'){if(x===0||x===1)return x;return 1-Math.exp(-7*x)*Math.cos(12*x)}
  return x
}
