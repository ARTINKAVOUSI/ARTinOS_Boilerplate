import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { TelemetrySample } from '../core/telemetry'
import { useArtinosRuntime } from './runtime'

export interface FrameProfilePass { id:string;name:string;kind:'render'|'compute';cpuMs:number;gpuMs:number;gpuAvailable:boolean }
export interface FrameProfileGraph { fps:number[];cpu:number[];gpu:number[] }
export interface FrameProfile { frameId:number;fps:number;frameMs:number;cpuMs:number;gpuMs:number;totalMs:number;idleMs:number;timestampAvailable:boolean;source:string;passes:FrameProfilePass[];graph:FrameProfileGraph }
export interface FrameProfileResource { current:FrameProfile|null }

const finite=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback
const sample=(id:string,value:number|string|boolean,unit?:string,group='performance',metadata?:Record<string,unknown>):TelemetrySample=>({id,value,options:{unit,group,metadata}})

function readProfile(renderer:any):FrameProfile|null{
  const inspector=renderer.inspector,frames=inspector?.frames
  if(!Array.isArray(frames))return null
  // The newest inspector frame is often still awaiting async timestamp
  // resolution. Performance.updateText() uses the latest resolved frame too;
  // mirror that contract so every ARTINOS readout agrees with the inspector.
  const frame=[...frames].reverse().find((candidate:any)=>candidate?.resolvedCompute===true&&candidate?.resolvedRender===true&&Number.isFinite(candidate?.cpu))
  if(!frame)return null
  const timestampAvailable=Boolean(renderer.backend?.hasTimestamp)
  const passes:FrameProfilePass[]=(frame.children??[]).map((stats:any,index:number)=>{
    const gpuAvailable=timestampAvailable&&stats.gpuNotAvailable!==true
    // Resolved frame children already contain final timings. Calling getStatsData
    // outside the inspector's frame scope emits a warning and adds no accuracy.
    return{id:String(stats.cid??index),name:String(stats.name||`Pass ${index+1}`),kind:stats.isComputeStats?'compute':'render',cpuMs:finite(stats.cpu),gpuMs:gpuAvailable?finite(stats.gpu):0,gpuAvailable}
  })
  const rawFrameMs=finite(frame.deltaTime,finite(frame.finishTime)-finite(frame.startTime)),fps=finite(inspector.fps,rawFrameMs>0?1000/rawFrameMs:0),frameMs=fps>0?1000/fps:rawFrameMs,cpuMs=finite(frame.cpu),gpuMs=timestampAvailable?finite(frame.gpu):0,totalMs=finite(frame.total,cpuMs+gpuMs)
  const lines=inspector.performance?.graph?.lines??{},graph:FrameProfileGraph={fps:[...(lines.fps?.points??[])],cpu:[...(lines.cpu?.points??[])],gpu:[...(lines.gpu?.points??[])]}
  return{frameId:finite(frame.frameId),fps,frameMs,cpuMs,gpuMs,totalMs,idleMs:Math.max(0,finite(frame.miscellaneous,rawFrameMs-totalMs)),timestampAvailable,source:timestampAvailable?'Three RendererInspector timestamp queries':'Three RendererInspector CPU timing',passes,graph}
}

function readRenderer(renderer:any){
  const info=renderer.info??{},render=info.render??{},memory=info.memory??{},canvas=renderer.domElement
  const samples:TelemetrySample[]=[
    sample('renderer.backend',renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2',undefined,'renderer'),
    sample('renderer.resolution',`${canvas?.width??0}×${canvas?.height??0}`,undefined,'renderer'),
    sample('renderer.viewport',`${canvas?.clientWidth??0}×${canvas?.clientHeight??0}`,undefined,'renderer'),
    sample('renderer.dpr',finite(renderer.getPixelRatio?.(),window.devicePixelRatio),'×','renderer'),
    sample('renderer.calls',finite(render.drawCalls,finite(render.calls,finite(render.frameCalls))),undefined,'renderer',{source:'renderer.info.render per-frame counter'}),
    sample('renderer.triangles',finite(render.triangles),undefined,'renderer'),sample('renderer.lines',finite(render.lines),undefined,'renderer'),sample('renderer.points',finite(render.points),undefined,'renderer')
  ]
  const fields:[string,string,string?][]=[['total','totalBytes','bytes'],['attributes','attributes'],['attributesSize','attributesBytes','bytes'],['geometries','geometries'],['indexAttributes','indexAttributes'],['indexAttributesSize','indexBytes','bytes'],['indirectStorageAttributes','indirectStorageAttributes'],['indirectStorageAttributesSize','indirectStorageBytes','bytes'],['programs','programs'],['programsSize','programBytes','bytes'],['readbackBuffers','readbackBuffers'],['readbackBuffersSize','readbackBytes','bytes'],['renderTargets','renderTargets'],['storageAttributes','storageAttributes'],['storageAttributesSize','storageBytes','bytes'],['textures','textures'],['texturesSize','textureBytes','bytes'],['uniformBuffers','uniformBuffers'],['uniformBuffersSize','uniformBufferBytes','bytes']]
  for(const[source,id,unit]of fields)if(Number.isFinite(memory[source]))samples.push(sample(`memory.${id}`,finite(memory[source]),unit,'memory',{source:'Three renderer.info.memory'}))
  return{samples,hasNativeMemory:Number.isFinite(memory.total)}
}

function scanScene(scene:any){
  let objects=0,lights=0,meshes=0,estimatedBytes=0
  const geometries=new Set<any>(),textures=new Set<any>()
  scene.traverse?.((object:any)=>{objects++;if(object.isLight)lights++;if(object.isMesh||object.isInstancedMesh)meshes++;const geometry=object.geometry;if(geometry&&!geometries.has(geometry)){geometries.add(geometry);if(geometry.index?.array)estimatedBytes+=finite(geometry.index.array.byteLength);for(const attribute of Object.values(geometry.attributes??{}) as any[])estimatedBytes+=finite(attribute?.array?.byteLength)}const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];for(const material of materials)for(const value of Object.values(material) as any[]){if(!value?.isTexture||textures.has(value))continue;textures.add(value);const image=value.image,bytes=finite(image?.width||image?.videoWidth,1)*finite(image?.height||image?.videoHeight,1)*4*(value.generateMipmaps?1.33:1);estimatedBytes+=bytes}})
  return{objects,lights,meshes,geometries:geometries.size,textures:textures.size,estimatedBytes:Math.round(estimatedBytes)}
}

export function RendererTelemetry({logsPerSecond=10}:{logsPerSecond?:number}){
  const runtime=useArtinosRuntime(),renderer=useThree((state:any)=>state.renderer??state.gl),scene=useThree((state:any)=>state.scene)
  const profileResource=useRef<FrameProfileResource>({current:null}),state=useRef({frames:[] as number[],lastPublish:0,lastScan:0,gpuProbeFrame:0,gpuPending:false,scene:null as ReturnType<typeof scanScene>|null})
  useEffect(()=>runtime.resources.set('telemetry.frameProfile',profileResource.current,{kind:'telemetry',owner:'@artinos/runtime'}),[runtime])
  useFrame((_state,delta)=>{const frames=state.current.frames;frames.push(delta*1000);if(frames.length>60)frames.shift()})
  useFrame(()=>{
    const now=performance.now(),interval=1000/Math.max(1,logsPerSecond)
    if(now-state.current.lastPublish<interval)return
    state.current.lastPublish=now
    const profile=readProfile(renderer),frames=state.current.frames,averageFrameMs=frames.length?frames.reduce((sum,value)=>sum+value,0)/frames.length:0,frameMs=profile?.frameMs||averageFrameMs,fps=profile?.fps||(frameMs>0?1000/frameMs:0),targetFps=runtime.quality.getState().targetFps,frameBudget=1000/targetFps
    if(profile)profileResource.current.current=profile
    const rendererData=readRenderer(renderer),samples:TelemetrySample[]=[
      sample('performance.fps',fps,'fps'),sample('performance.frameMs',frameMs,'ms'),sample('performance.frameLoad',Math.min(999,frameMs/frameBudget*100),'%'),
      ...rendererData.samples,
      sample('runtime.resources',runtime.resources.list().length,undefined,'runtime'),sample('runtime.frameTasks',runtime.frames.list().length,undefined,'runtime'),sample('runtime.signals',runtime.signals.list().length,undefined,'runtime'),sample('runtime.parameters',runtime.parameters.list().length,undefined,'runtime')
    ]
    if(profile){samples.push(sample('performance.cpuMs',profile.cpuMs,'ms','performance',{source:profile.source}),sample('performance.cpuLoad',Math.min(100,profile.cpuMs/Math.max(frameMs,.001)*100),'%','performance',{source:profile.source}),sample('performance.totalMs',profile.totalMs,'ms','performance',{source:profile.source}),sample('performance.idleMs',profile.idleMs,'ms','performance',{source:'Three RendererInspector frame remainder'}),sample('performance.renderPasses',profile.passes.filter(pass=>pass.kind==='render').length,undefined,'performance'),sample('performance.computePasses',profile.passes.filter(pass=>pass.kind==='compute').length,undefined,'performance'),sample('performance.gpuTimestamp',profile.timestampAvailable,undefined,'performance'))
      if(profile.timestampAvailable)samples.push(sample('performance.gpuMs',profile.gpuMs,'ms','performance',{source:profile.source}),sample('performance.gpuLoad',Math.min(100,profile.gpuMs/Math.max(frameMs,.001)*100),'%','performance',{source:profile.source}))
    }
    if(now-state.current.lastScan>=1000){state.current.lastScan=now;state.current.scene=scanScene(scene)}
    const scan=state.current.scene
    if(scan){samples.push(sample('renderer.objects',scan.objects,undefined,'renderer',{source:'1 Hz scene traversal'}),sample('renderer.meshes',scan.meshes,undefined,'renderer',{source:'1 Hz scene traversal'}),sample('renderer.lights',scan.lights,undefined,'renderer',{source:'1 Hz scene traversal'}));if(!rendererData.hasNativeMemory)samples.push(sample('memory.estimatedBytes',scan.estimatedBytes,'bytes','memory',{source:'1 Hz scene estimate; not driver allocation'}),sample('memory.geometries',scan.geometries,undefined,'memory',{source:'1 Hz scene estimate'}),sample('memory.textures',scan.textures,undefined,'memory',{source:'1 Hz scene estimate'}))}
    runtime.telemetry.setMany(samples)
    const queue=renderer.backend?.device?.queue
    if(!profile?.timestampAvailable&&queue?.onSubmittedWorkDone&&++state.current.gpuProbeFrame%8===0&&!state.current.gpuPending){state.current.gpuPending=true;const started=performance.now();queue.onSubmittedWorkDone().then(()=>{const latency=performance.now()-started;runtime.telemetry.setMany([sample('performance.gpuQueueLatency',latency,'ms','performance',{source:'WebGPU queue completion latency; not GPU execution time'})])}).finally(()=>{state.current.gpuPending=false})}
  },{phase:'finish'})
  return null
}
