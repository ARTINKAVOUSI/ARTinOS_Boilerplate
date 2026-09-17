import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react'

export type PostFXType='bloom'|'dof'|'afterImage'|'anamorphic'|'chromaticAberration'|'dotScreen'|'film'|'fxaa'|'rgbShift'|'smaa'|'sobel'|'sepia'|'grayscale'|'motionBlur'|'ssr'|'ssgi'|'gtao'|'traa'|'taau'|'bleach'|'gaussianBlur'|'hashBlur'|'sharpen'|'fsr1'|'vignette'|'boxBlur'|'denoise'|'lensflare'|'outline'|'posterize'|'colorBleeding'|'scanlines'|'hue'|'saturation'|'ssaa'|'sss'|'godrays'|'lut3d'|'transition'|'pixelation'|'retro'|'radialBlur'|'bilateralBlur'|'recurrentDenoise'
export interface PostFXEffect{id:string;type:PostFXType;enabled?:boolean;order?:number;params?:Record<string,number|boolean>;resources?:string[];minTier?:'low'|'balanced'|'high'|'ultra';fallback?:'disable'|PostFXType;supportedBackend?:'webgpu'|'webgl2'|'both'}
export interface PostFXRuntimeState{id:string;type:PostFXType;state:'disabled'|'active'|'fallback'|'unavailable';reason?:string;fallback?:PostFXType;backend:'webgpu'|'webgl2';tier:string}
const tierRank={low:0,balanced:1,high:2,ultra:3} as const
/** SSGI sampling density per quality tier (hemisphere slices × steps per side). */
export const SSGI_TIER_SAMPLING:Record<keyof typeof tierRank,{slices:number;steps:number}>={low:{slices:1,steps:8},balanced:{slices:2,steps:8},high:{slices:3,steps:12},ultra:{slices:4,steps:16}}
export const resolvePostFXCapability=(effect:PostFXEffect,backend:'webgpu'|'webgl2',tier:keyof typeof tierRank,hasResource:(id:string)=>boolean):Pick<PostFXRuntimeState,'state'|'reason'|'fallback'>=>{if(effect.enabled===false)return{state:'disabled'};const supported=effect.supportedBackend,incompatible=supported&&supported!=='both'&&supported!==backend,missing=effect.resources?.find(id=>!hasResource(id)),belowTier=effect.minTier&&tierRank[tier]<tierRank[effect.minTier],reason=incompatible?`Requires ${supported==='webgpu'?'WebGPU':'WebGL2'}`:missing?`Missing ${missing}`:belowTier?`Requires ${effect.minTier} quality`:undefined;if(!reason)return{state:'active'};return effect.fallback&&effect.fallback!=='disable'?{state:'fallback',reason,fallback:effect.fallback}:{state:'unavailable',reason}}

/** Scene-pass attachments the enabled effects read. Disabled effects never add attachments. */
const NORMAL_READERS=new Set<string>(['ssr','gtao','denoise'])
const PACKED_NORMAL_READERS=new Set<string>(['ssgi','recurrentDenoise'])
const VELOCITY_READERS=new Set<string>(['traa','taau','motionBlur'])
export interface SceneAttachments{normal:boolean;packedNormal:boolean;velocity:boolean;diffuse:boolean}
export function resolveSceneAttachments(effects:readonly Pick<PostFXEffect,'type'|'enabled'>[],pipelineEnabled=true):SceneAttachments{
  const on=new Set<string>(pipelineEnabled?effects.filter(e=>e.enabled!==false).map(e=>e.type):[])
  const any=(readers:Set<string>)=>[...readers].some(type=>on.has(type))
  return{normal:any(NORMAL_READERS),packedNormal:any(PACKED_NORMAL_READERS),velocity:any(VELOCITY_READERS),diffuse:on.has('ssgi')}
}

export class PostFXController{
  private effects=new Map<string,PostFXEffect>();private runtimeStates=new Map<string,PostFXRuntimeState>();private listeners=new Set<()=>void>();revision=0;enabled=true
  register(effect:PostFXEffect){this.effects.set(effect.id,{...effect});this.bump();return()=>{this.remove(effect.id)}}
  upsert(effect:PostFXEffect){this.effects.set(effect.id,{...effect});this.bump()}
  update(id:string,patch:Partial<Omit<PostFXEffect,'id'>>){const current=this.effects.get(id);if(!current)return false;this.effects.set(id,{...current,...patch,id});this.bump();return true}
  remove(id:string){const ok=this.effects.delete(id);if(ok)this.bump();return ok}
  clear(){if(!this.effects.size)return;this.effects.clear();this.bump()}
  setEnabled(value:boolean){if(this.enabled===value)return;this.enabled=value;this.bump()}
  setEffectEnabled(id:string,value:boolean){return this.update(id,{enabled:value})}
  move(id:string,order:number){return this.update(id,{order})}
  snapshot=()=>[...this.effects.values()].sort((a,b)=>(a.order??0)-(b.order??0))
  runtimeSnapshot=()=>[...this.runtimeStates.values()]
  runtimeState=(id:string)=>this.runtimeStates.get(id)
  setRuntimeStates(states:PostFXRuntimeState[]){const next=JSON.stringify(states),current=JSON.stringify(this.runtimeSnapshot());if(next===current)return;this.runtimeStates=new Map(states.map(state=>[state.id,state]));this.bump()}
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}
}

const PostFXContext=createContext<PostFXController|null>(null)
export function PostFXProvider({children,controller}:PropsWithChildren<{controller?:PostFXController}>){const local=useMemo(()=>controller??new PostFXController(),[controller]);return <PostFXContext.Provider value={local}>{children}</PostFXContext.Provider>}
export function usePostFXController(){const controller=useContext(PostFXContext);if(!controller)throw new Error('PostFX components require PostFXProvider');return controller}
export function usePostFX(effect:PostFXEffect){const controller=usePostFXController(),key=JSON.stringify(effect);useEffect(()=>controller.register(effect),[controller,key])}

/**
 * Layer that transmissive materials move their meshes onto, so the transmission backdrop pass can
 * render the scene *without* them. The viewing camera keeps the layer enabled, so the glass is
 * still drawn in the beauty pass; only the backdrop pass masks it out.
 *
 * Owned by the render pipeline rather than by any material, and declared here (not in
 * `postfx-pipeline`) so materials can import it without pulling the pipeline out of its lazy chunk.
 */
export const TRANSMISSION_GLASS_LAYER = 2

/** Resource id carrying the backdrop texture node that transmissive materials sample. */
export const TRANSMISSION_BACKDROP_RESOURCE = 'render.transmissionBackdrop'
