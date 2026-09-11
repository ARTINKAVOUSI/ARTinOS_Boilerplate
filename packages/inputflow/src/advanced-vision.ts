import type { ArtinosRuntime, Unsubscribe } from '@artinos/runtime'
import { deriveVisionSemantics, initialVisionSemanticState } from './vision-semantics'
import type { VisionFeature, VisionWorkerResponse } from './vision-protocol'

export type AdvancedVisionFeature='hands'|'face'|'pose'|'gestures'|'objects'
export interface AdvancedVisionOptions{features?:AdvancedVisionFeature[];wasmPath?:string;models?:Partial<Record<VisionFeature,string>>;frequency?:number}
const defaults={wasmPath:`${location.origin}/mediapipe/wasm`,models:{hands:'/mediapipe/models/hand_landmarker.task',face:'/mediapipe/models/face_landmarker.task',pose:'/mediapipe/models/pose_landmarker_lite.task',gestures:'/mediapipe/models/gesture_recognizer.task',objects:'/mediapipe/models/efficientdet_lite0.tflite'} as Record<VisionFeature,string>}

export class AdvancedVisionEngine{
  private worker:Worker|null=null;private frameDispose:Unsubscribe|null=null;private qualityDispose:Unsubscribe|null=null
  private active=false;private inFlight=false;private frameId=0;private drops=0;private targetFps:number;private semantic=initialVisionSemanticState()
  private options:Required<Pick<AdvancedVisionOptions,'features'|'wasmPath'|'frequency'>>&{models:Record<VisionFeature,string>}
  constructor(private runtime:ArtinosRuntime,options:AdvancedVisionOptions={}){this.options={features:options.features??['hands'],wasmPath:options.wasmPath??defaults.wasmPath,frequency:options.frequency??20,models:{...defaults.models,...options.models}};this.targetFps=this.options.frequency}
  isActive(){return this.active}enabledFeatures(){return[...this.options.features]}
  async enable(video?:HTMLVideoElement){
    if(this.active)return
    const source=video??this.runtime.resources.get<HTMLVideoElement>('media.vision.video');if(!source)throw new Error('Enable the camera before Advanced Vision')
    const worker=new Worker(new URL('./vision-worker.ts',import.meta.url),{type:'module',name:'artinos-vision'});this.worker=worker
    try{await new Promise<void>((resolve,reject)=>{const onMessage=(event:MessageEvent<VisionWorkerResponse>)=>{if(event.data.type==='ready'){worker.removeEventListener('message',onMessage);resolve()}else if(event.data.type==='error'){worker.removeEventListener('message',onMessage);reject(new Error(event.data.message))}};worker.addEventListener('message',onMessage);worker.addEventListener('error',event=>reject(event.error??new Error(event.message)),{once:true});worker.postMessage({type:'init',features:this.options.features,wasmPath:this.options.wasmPath,models:this.options.models})})}
    catch(error){worker.terminate();if(this.worker===worker)this.worker=null;this.publishError(error);throw error}
    worker.onmessage=event=>this.onMessage(event.data);this.active=true
    this.qualityDispose=this.runtime.quality.register('input.vision.quality',quality=>{this.targetFps=Math.round(8+22*quality.scalar);this.runtime.telemetry.set('input.vision.targetFps',this.targetFps,{group:'input',unit:'fps'})})
    this.frameDispose=this.runtime.frames.add({id:'input.vision.advanced',phase:'input',priority:25,frequency:30,run:()=>{void this.submitFrame(source)}})
    this.runtime.telemetry.set('input.vision.advanced','worker',{group:'input'})
  }
  async submitFrame(video:HTMLVideoElement,timestamp=performance.now()){if(!this.active||!this.worker||this.inFlight||video.readyState<2){if(this.inFlight)this.drops++;return false}this.inFlight=true;try{const bitmap=await createImageBitmap(video);this.worker.postMessage({type:'frame',frameId:++this.frameId,timestamp,bitmap},[bitmap]);return true}catch(error){this.inFlight=false;this.publishError(error);return false}}
  disable(){this.frameDispose?.();this.qualityDispose?.();this.frameDispose=this.qualityDispose=null;if(this.worker){const worker=this.worker,force=setTimeout(()=>worker.terminate(),10_000),onMessage=(event:MessageEvent<VisionWorkerResponse>)=>{if(event.data.type!=='disposed')return;clearTimeout(force);worker.removeEventListener('message',onMessage);worker.terminate();this.runtime.telemetry.set('input.vision.disposed',true,{group:'input'})};worker.addEventListener('message',onMessage);worker.postMessage({type:'dispose'})}this.worker=null;this.active=false;this.inFlight=false;this.runtime.telemetry.set('input.vision.advanced','off',{group:'input'})}
  dispose(){this.disable()}
  private onMessage(message:VisionWorkerResponse){if(message.type==='error'){this.inFlight=false;this.publishError(message.message);return}if(message.type!=='result')return;this.inFlight=false;const frame=deriveVisionSemantics(this.semantic,message.result,performance.now());this.semantic=frame.state;const r=message.result;this.runtime.signals.set('vision.hand.count',r.hands.length);this.runtime.signals.set('vision.face.count',r.faces.length);this.runtime.signals.set('vision.pose.count',r.poses.length);r.hands.forEach((hand,index)=>{const prefix=`vision.hand.${hand.handedness}`;this.runtime.signals.set(`${prefix}.landmarks`,hand.landmarks);this.runtime.signals.set(`vision.hand.${index}.landmarks`,hand.landmarks)});this.runtime.signals.set('vision.gesture.current',frame.gesture);this.runtime.signals.set('vision.swipe',frame.swipe);this.runtime.signals.set('vision.depth',frame.depth);this.runtime.signals.set('vision.pointer',frame.pointer);this.runtime.signals.set('vision.skeleton',frame.skeleton);this.runtime.signals.set('vision.objects',r.objects);this.runtime.telemetry.set('input.vision.latencyP50',frame.metrics.latencyP50,{group:'input',unit:'ms'});this.runtime.telemetry.set('input.vision.latencyP95',frame.metrics.latencyP95,{group:'input',unit:'ms'});this.runtime.telemetry.set('input.vision.drops',this.drops,{group:'input'});this.runtime.telemetry.set('input.vision.backlog',this.inFlight?1:0,{group:'input'})}
  private publishError(error:unknown){const message=error instanceof Error?error.message:String(error);this.runtime.telemetry.set('input.vision.advancedError',message,{group:'input'});this.runtime.logger.warn(message,{source:'advanced-vision'})}
}
