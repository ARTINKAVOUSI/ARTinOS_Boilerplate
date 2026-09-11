import * as THREE from 'three/webgpu'
import { texture, vec4 } from 'three/tsl'
import type { ArtinosRuntime } from '../core'

export interface NodePreviewFrame{key:string;width:number;height:number;pixels:Uint8Array;updatedAt:number}
export interface NodePreviewRequest{key:string;node:unknown}

const SIZE=64,INTERVAL_MS=320

/**
 * Renders TSL nodes to small thumbnails using the one shared renderer.
 *
 * Every capture happens inside a frame phase with a single-flight guard: a
 * second pass issued outside the frame loop, or overlapping passes, is the
 * fastest way to wedge a WebGPU device. A GPU readback stalls the frame, so at most one thumbnail is produced per
 * interval and the queue is round-robined, so N previewed nodes cost one extra
 * off-screen quad every INTERVAL_MS rather than N per frame.
 */
export class NodePreviewService{
  revision=0
  private requests=new Map<string,unknown>()
  private frames=new Map<string,NodePreviewFrame>()
  private listeners=new Set<()=>void>()
  private target:THREE.RenderTarget|null=null
  private quad:THREE.QuadMesh|null=null
  private material:THREE.NodeMaterial|null=null
  private inFlight=false
  private cursor=0
  private lastAt=0
  private failed=new Set<string>()
  private disposed=false

  constructor(private renderer:any){}

  request(key:string,node:unknown){
    if(node==null)return
    if(this.requests.get(key)===node)return
    this.requests.set(key,node)
    this.failed.delete(key)
  }
  release(key:string){this.requests.delete(key);this.frames.delete(key);this.failed.delete(key);this.bump()}
  get(key:string){return this.frames.get(key)}
  subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn)}}
  private bump(){this.revision++;this.listeners.forEach(fn=>fn())}

  /** Call from a frame phase only. */
  tick(now:number){
    if(this.disposed||this.inFlight||!this.requests.size)return
    if(now-this.lastAt<INTERVAL_MS)return
    const keys=[...this.requests.keys()].filter(key=>!this.failed.has(key))
    if(!keys.length)return
    this.lastAt=now
    this.cursor=(this.cursor+1)%keys.length
    const key=keys[this.cursor],node=this.requests.get(key)
    if(!node)return
    this.inFlight=true
    void this.capture(key,node).catch(()=>{this.failed.add(key)}).finally(()=>{this.inFlight=false})
  }

  private async capture(key:string,node:any){
    if(!this.target){
      this.target=new THREE.RenderTarget(SIZE,SIZE,{depthBuffer:false,stencilBuffer:false})
      this.material=new THREE.NodeMaterial()
      this.quad=new THREE.QuadMesh(this.material)
    }
    const material=this.material as THREE.NodeMaterial&{fragmentNode?:unknown}
    // vec4(x) accepts a scalar (splatting it to grey) or an existing vec4
    // unchanged, and .xyz then drops the alpha channel. vec3(x) cannot do this:
    // it leaves a vec4 at four components, so vec4(that,1) overflows to five.
    // Alpha is forced opaque or a dim scalar reads back as a transparent frame.
    material.fragmentNode=vec4(vec4(resolvePreviewNode(node)).xyz,1)
    material.needsUpdate=true
    const target=this.target
    const previous=this.renderer.getRenderTarget()
    const previousMRT=this.renderer.getMRT()
    try{
      this.renderer.setMRT(null)
      this.renderer.setRenderTarget(target)
      // Submit synchronously. Never yield with the shared renderer redirected.
      this.quad!.render(this.renderer)
    }finally{
      this.renderer.setRenderTarget(previous)
      this.renderer.setMRT(previousMRT)
    }
    // The 6th argument is textureIndex, not a destination buffer: the pixels are returned.
    const pixels=new Uint8Array(await this.renderer.readRenderTargetPixelsAsync(target,0,0,SIZE,SIZE))
    if(this.disposed||this.requests.get(key)!==node)return
    this.frames.set(key,{key,width:SIZE,height:SIZE,pixels,updatedAt:performance.now()})
    this.bump()
  }

  dispose(){
    this.disposed=true
    this.requests.clear();this.frames.clear();this.listeners.clear()
    this.target?.dispose();this.material?.dispose()
    this.target=null;this.quad=null;this.material=null
  }
}


/** A render pass is previewed through its beauty texture, not the pass itself. */
function resolvePreviewNode(node:any){
  if(node&&node.isPassNode&&typeof node.getTextureNode==='function')return texture(node.getTextureNode().value)
  if(node?.isTextureNode&&node.value?.isTexture)return texture(node.value)
  return node
}

export function installNodePreview(runtime:ArtinosRuntime,renderer:unknown){
  const service=new NodePreviewService(renderer)
  const releaseResource=runtime.resources.set('node.preview',service,{kind:'preview',owner:'@artinos/runtime'})
  const releaseTask=runtime.frames.add({id:'runtime.node-preview',phase:'post-render',priority:900,run:()=>service.tick(performance.now())})
  return()=>{releaseTask();releaseResource();service.dispose()}
}
