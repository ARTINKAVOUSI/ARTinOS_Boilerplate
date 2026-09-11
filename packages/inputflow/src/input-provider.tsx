import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import type { ArtinosRuntime } from '@artinos/runtime'
import { SignalRecorder } from './recorder'
import { AdvancedVisionEngine } from './advanced-vision'
import { ExternalSignalManager } from './external-signals'
export * from './recorder'
export * from './advanced-vision'
export * from './vision-protocol'
export * from './vision-semantics'
import { useArtinosRuntime } from '@artinos/runtime'

export type InputState='off'|'requesting'|'on'|'error'|'unavailable'
export interface InputStatus { pointer:InputState; keyboard:InputState; gamepad:InputState; audio:InputState; camera:InputState; advancedVision:InputState; midi:InputState; orientation:InputState }
export interface InputAPI {
  status:InputStatus
  enableAudio():Promise<void>;enableAudioFile(file:File):Promise<void>;disableAudio():void
  enableCamera():Promise<void>;disableCamera():void
  enableAdvancedVision():Promise<void>;disableAdvancedVision():void
  enableMidi():Promise<void>
  enableOrientation():Promise<void>;disableOrientation():void
  recorder:SignalRecorder
  advancedVision:AdvancedVisionEngine
  externalSignals:ExternalSignalManager
}
const Context=createContext<InputAPI|null>(null)
export function useInputs(){const c=useContext(Context);if(!c)throw new Error('useInputs requires InputProvider');return c}

const now=()=>performance.now()
const signal=(runtime:ArtinosRuntime,id:string,value:unknown,metadata?:Record<string,unknown>)=>runtime.signals.set(id,value,metadata)

function installAudioAnalysis(runtime:ArtinosRuntime,ctx:AudioContext,analyser:AnalyserNode,id='input.audio'){
  const freq=new Uint8Array(analyser.frequencyBinCount),wave=new Uint8Array(analyser.fftSize);let envelope=0,beatMean=0,beatVar=0,lastBeat=0
  const bandHz=(lo:number,hi:number)=>{const nyquist=ctx.sampleRate/2,from=Math.max(0,Math.floor(lo/nyquist*freq.length)),to=Math.min(freq.length,Math.max(from+1,Math.floor(hi/nyquist*freq.length)));let sum=0;for(let i=from;i<to;i++)sum+=freq[i]/255;return sum/(to-from)}
  return runtime.frames.add({id,phase:'input',frequency:60,run:()=>{analyser.getByteFrequencyData(freq);analyser.getByteTimeDomainData(wave);let sq=0,peak=0;for(const v of wave){const x=(v-128)/128;sq+=x*x;peak=Math.max(peak,Math.abs(x))}const rms=Math.sqrt(sq/wave.length);envelope+=((rms>envelope?.36:.08))*(rms-envelope);const bass=bandHz(20,180),lowMid=bandHz(180,500),mid=bandHz(500,2000),highMid=bandHz(2000,6000),high=bandHz(6000,Math.min(18000,ctx.sampleRate/2));beatMean=beatMean*.97+bass*.03;const delta=bass-beatMean;beatVar=beatVar*.97+delta*delta*.03;const threshold=beatMean+Math.sqrt(beatVar)*1.8,t=now(),beat=bass>threshold&&t-lastBeat>180;if(beat)lastBeat=t;signal(runtime,'audio.rms',rms);signal(runtime,'audio.peak',peak);signal(runtime,'audio.envelope',envelope);signal(runtime,'audio.sub',bandHz(20,60));signal(runtime,'audio.bass',bass);signal(runtime,'audio.lowMid',lowMid);signal(runtime,'audio.mid',mid);signal(runtime,'audio.highMid',highMid);signal(runtime,'audio.high',high);signal(runtime,'audio.beat',beat?1:0);signal(runtime,'audio.beatThreshold',threshold);signal(runtime,'audio.sampleRate',ctx.sampleRate);signal(runtime,'audio.waveform',Array.from(wave.filter((_v,i)=>i%64===0),v=>(v-128)/128));signal(runtime,'audio.spectrum',Array.from(freq.filter((_v,i)=>i%16===0),v=>v/255))}})
}

export function InputProvider({children}:PropsWithChildren){
  const runtime=useArtinosRuntime()
  const recorder=useMemo(()=>new SignalRecorder(runtime),[runtime])
  const advancedVision=useMemo(()=>new AdvancedVisionEngine(runtime),[runtime])
  const externalSignals=useMemo(()=>new ExternalSignalManager(runtime),[runtime])
  const [status,setStatus]=useState<InputStatus>({pointer:'on',keyboard:'on',gamepad:'on',audio:'off',camera:'off',advancedVision:'off',midi:'off',orientation:'off'})
  const audioCleanup=useRef<null|(()=>void)>(null),cameraCleanup=useRef<null|(()=>void)>(null),orientationCleanup=useRef<null|(()=>void)>(null),midiCleanup=useRef<null|(()=>void)>(null)

  useEffect(()=>runtime.resources.set('input.vision.advanced.engine',advancedVision,{kind:'input-engine',owner:'inputflow'}),[runtime,advancedVision])

  useEffect(()=>{
    let lastX=0,lastY=0,lastT=now(),wheelX=0,wheelY=0
    const onPointer=(e:PointerEvent)=>{const t=now(),dt=Math.max(1,t-lastT)/1000,dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;lastT=t;signal(runtime,'pointer.position',[e.clientX,e.clientY]);signal(runtime,'pointer.ndc',[e.clientX/window.innerWidth*2-1,-(e.clientY/window.innerHeight)*2+1]);signal(runtime,'pointer.delta',[dx,dy]);signal(runtime,'pointer.velocity',[dx/dt,dy/dt]);signal(runtime,'pointer.speed',Math.hypot(dx,dy)/dt);signal(runtime,'pointer.pressure',e.pressure);signal(runtime,'pointer.tilt',[e.tiltX,e.tiltY]);signal(runtime,'pointer.type',e.pointerType);signal(runtime,'pointer.buttons',e.buttons)}
    const onDown=(e:KeyboardEvent)=>{signal(runtime,`keyboard.key.${e.code}`,1);signal(runtime,'keyboard.last',e.code);signal(runtime,'keyboard.modifiers',{alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey})}
    const onUp=(e:KeyboardEvent)=>{signal(runtime,`keyboard.key.${e.code}`,0);signal(runtime,'keyboard.modifiers',{alt:e.altKey,ctrl:e.ctrlKey,meta:e.metaKey,shift:e.shiftKey})}
    const onWheel=(e:WheelEvent)=>{wheelX+=e.deltaX;wheelY+=e.deltaY;signal(runtime,'pointer.wheel.delta',[e.deltaX,e.deltaY,e.deltaZ]);signal(runtime,'pointer.wheel.accumulated',[wheelX,wheelY])}
    const onResize=()=>{signal(runtime,'viewport.size',[window.innerWidth,window.innerHeight]);signal(runtime,'viewport.aspect',window.innerWidth/Math.max(1,window.innerHeight));signal(runtime,'viewport.dpr',window.devicePixelRatio)}
    window.addEventListener('pointermove',onPointer,{passive:true});window.addEventListener('pointerdown',onPointer,{passive:true});window.addEventListener('pointerup',onPointer,{passive:true});window.addEventListener('wheel',onWheel,{passive:true});window.addEventListener('keydown',onDown);window.addEventListener('keyup',onUp);window.addEventListener('resize',onResize);onResize()
    const removeGamepad=runtime.frames.add({id:'input.gamepads',phase:'input',frequency:60,run:()=>{const pads=navigator.getGamepads?.()??[];let connected=0;for(const pad of pads){if(!pad)continue;connected++;signal(runtime,`gamepad.${pad.index}.connected`,1,{id:pad.id});pad.axes.forEach((v,i)=>signal(runtime,`gamepad.${pad.index}.axis.${i}`,v));pad.buttons.forEach((b,i)=>{signal(runtime,`gamepad.${pad.index}.button.${i}`,b.value);signal(runtime,`gamepad.${pad.index}.pressed.${i}`,b.pressed?1:0)})}signal(runtime,'gamepad.count',connected)}})
    return()=>{advancedVision.dispose();externalSignals.dispose();window.removeEventListener('pointermove',onPointer);window.removeEventListener('pointerdown',onPointer);window.removeEventListener('pointerup',onPointer);window.removeEventListener('wheel',onWheel);window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('resize',onResize);removeGamepad();audioCleanup.current?.();cameraCleanup.current?.();orientationCleanup.current?.();midiCleanup.current?.()}
  },[runtime])

  const disableAudio=useCallback(()=>{audioCleanup.current?.();audioCleanup.current=null;setStatus(s=>({...s,audio:'off'}))},[])
  const enableAudio=useCallback(async()=>{
    if(audioCleanup.current)return; if(!navigator.mediaDevices?.getUserMedia){setStatus(s=>({...s,audio:'unavailable'}));return}
    setStatus(s=>({...s,audio:'requesting'}))
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})
      const ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaStreamSource(stream);const analyser=ctx.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=.72;source.connect(analyser)
      const remove=installAudioAnalysis(runtime,ctx,analyser)
      audioCleanup.current=()=>{remove();stream.getTracks().forEach(t=>t.stop());source.disconnect();analyser.disconnect();ctx.close().catch(()=>{})};setStatus(s=>({...s,audio:'on'}));runtime.logger.info('Microphone analysis enabled',{source:'input'})
    }catch(error){runtime.telemetry.set('input.audio.error',error instanceof Error?error.message:String(error),{group:'input'});setStatus(s=>({...s,audio:'error'}))}
  },[runtime])

  const enableAudioFile=useCallback(async(file:File)=>{
    disableAudio();setStatus(s=>({...s,audio:'requesting'}))
    try{const url=URL.createObjectURL(file),element=new Audio(url);element.loop=true;element.crossOrigin='anonymous';const ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaElementSource(element),analyser=ctx.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=.72;source.connect(analyser);analyser.connect(ctx.destination);const remove=installAudioAnalysis(runtime,ctx,analyser,'input.audio.file'),removeResource=runtime.resources.set('media.audio.element',element,{kind:'media',owner:'input'});await element.play();signal(runtime,'audio.source','file',{name:file.name,size:file.size,type:file.type});audioCleanup.current=()=>{remove();removeResource();element.pause();element.src='';source.disconnect();analyser.disconnect();ctx.close().catch(()=>{});URL.revokeObjectURL(url)};setStatus(s=>({...s,audio:'on'}));runtime.logger.info(`Audio file enabled: ${file.name}`,{source:'input'})}catch(error){runtime.telemetry.set('input.audio.error',error instanceof Error?error.message:String(error),{group:'input'});setStatus(s=>({...s,audio:'error'}))}
  },[runtime,disableAudio])

  const disableCamera=useCallback(()=>{advancedVision.disable();cameraCleanup.current?.();cameraCleanup.current=null;setStatus(s=>({...s,camera:'off',advancedVision:'off'}))},[advancedVision])
  const enableCamera=useCallback(async()=>{
    if(cameraCleanup.current)return;if(!navigator.mediaDevices?.getUserMedia){setStatus(s=>({...s,camera:'unavailable'}));return}setStatus(s=>({...s,camera:'requesting'}))
    try{const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();const removeVideo=runtime.resources.set('media.vision.video',video);const canvas=document.createElement('canvas');canvas.width=192;canvas.height=108;const ctx=canvas.getContext('2d',{willReadFrequently:true});let previous:Uint8ClampedArray|null=null
      const remove=runtime.frames.add({id:'input.vision',phase:'input',frequency:20,run:()=>{if(!ctx||video.readyState<2)return;ctx.drawImage(video,0,0,canvas.width,canvas.height);const image=ctx.getImageData(0,0,canvas.width,canvas.height),data=image.data;let lum=0,diff=0,r=0,g=0,b=0,cx=0,cy=0,mass=0;for(let y=0;y<canvas.height;y++){for(let x=0;x<canvas.width;x++){const i=(y*canvas.width+x)*4;const yy=(data[i]+data[i+1]+data[i+2])/765;r+=data[i];g+=data[i+1];b+=data[i+2];lum+=yy;if(previous){const d=(Math.abs(data[i]-previous[i])+Math.abs(data[i+1]-previous[i+1])+Math.abs(data[i+2]-previous[i+2]))/765;diff+=d;if(d>.12){cx+=x*d;cy+=y*d;mass+=d}}}}const px=canvas.width*canvas.height;signal(runtime,'vision.luminance',lum/px);signal(runtime,'vision.color.average',[r/(px*255),g/(px*255),b/(px*255)]);signal(runtime,'vision.motion.energy',diff/px);signal(runtime,'vision.motion.centroid',mass?[cx/mass/canvas.width,1-cy/mass/canvas.height]:[.5,.5]);signal(runtime,'vision.video.size',[video.videoWidth,video.videoHeight]);previous=new Uint8ClampedArray(data)}})
      cameraCleanup.current=()=>{remove();removeVideo();video.pause();video.srcObject=null;stream.getTracks().forEach(t=>t.stop())};setStatus(s=>({...s,camera:'on'}));runtime.logger.info('Camera/vision input enabled',{source:'input'})
    }catch(error){runtime.telemetry.set('input.camera.error',error instanceof Error?error.message:String(error),{group:'input'});setStatus(s=>({...s,camera:'error'}))}
  },[runtime])

  const disableAdvancedVision=useCallback(()=>{advancedVision.disable();setStatus(s=>({...s,advancedVision:'off'}))},[advancedVision])
  const enableAdvancedVision=useCallback(async()=>{setStatus(s=>({...s,advancedVision:'requesting'}));try{await advancedVision.enable();setStatus(s=>({...s,advancedVision:'on'}));runtime.logger.info('Advanced hand/face/pose vision enabled',{source:'input'})}catch(error){const message=error instanceof Error?error.message:String(error);runtime.telemetry.set('input.vision.advancedError',message,{group:'input'});setStatus(s=>({...s,advancedVision:'error'}))}},[advancedVision,runtime])

  const enableMidi=useCallback(async()=>{setStatus(s=>({...s,midi:'requesting'}));try{if(!navigator.requestMIDIAccess)throw new Error('Web MIDI is unavailable in this browser');const access=await navigator.requestMIDIAccess();const attach=(input:MIDIInput)=>{input.onmidimessage=(event)=>{const [statusByte=0,d1=0,d2=0]=event.data??[],type=statusByte&0xf0,channel=(statusByte&0x0f)+1,meta={channel,inputId:input.id};const noteOn=type===0x90&&d2>0;if(type===0xb0){signal(runtime,`midi.cc.${d1}`,d2/127,meta);signal(runtime,`midi.channel.${channel}.cc.${d1}`,d2/127,meta)}if(noteOn){signal(runtime,`midi.note.${d1}`,d2/127,meta);signal(runtime,`midi.channel.${channel}.note.${d1}`,d2/127,meta)}if(type===0x80||(type===0x90&&d2===0)){signal(runtime,`midi.note.${d1}`,0,meta);signal(runtime,`midi.channel.${channel}.note.${d1}`,0,meta)}if(type===0xe0){const bend=((d2<<7)|d1)/8191.5-1;signal(runtime,'midi.pitchbend',bend,meta);signal(runtime,`midi.channel.${channel}.pitchbend`,bend,meta)}signal(runtime,'midi.last',{status:type,channel,data1:d1,data2:d2,inputId:input.id})}};access.inputs.forEach(attach);access.onstatechange=()=>access.inputs.forEach(attach);midiCleanup.current=()=>{access.inputs.forEach(input=>{input.onmidimessage=null});access.onstatechange=null};setStatus(s=>({...s,midi:'on'}));runtime.logger.info('MIDI enabled',{source:'input'})}catch(error){runtime.telemetry.set('input.midi.error',error instanceof Error?error.message:String(error),{group:'input'});setStatus(s=>({...s,midi:'error'}))}},[runtime])

  const disableOrientation=useCallback(()=>{orientationCleanup.current?.();orientationCleanup.current=null;setStatus(s=>({...s,orientation:'off'}))},[])
  const enableOrientation=useCallback(async()=>{try{const D=(globalThis as any).DeviceOrientationEvent;if(!D){setStatus(s=>({...s,orientation:'unavailable'}));return}if(typeof D.requestPermission==='function'){const result=await D.requestPermission();if(result!=='granted')throw new Error('Orientation permission denied')}const onOrientation=(e:DeviceOrientationEvent)=>{signal(runtime,'sensor.orientation',[e.alpha??0,e.beta??0,e.gamma??0],{absolute:e.absolute})};window.addEventListener('deviceorientation',onOrientation);orientationCleanup.current=()=>window.removeEventListener('deviceorientation',onOrientation);setStatus(s=>({...s,orientation:'on'}))}catch(error){runtime.telemetry.set('input.orientation.error',error instanceof Error?error.message:String(error),{group:'input'});setStatus(s=>({...s,orientation:'error'}))}},[runtime])

  const api=useMemo<InputAPI>(()=>({status,enableAudio,enableAudioFile,disableAudio,enableCamera,disableCamera,enableAdvancedVision,disableAdvancedVision,enableMidi,enableOrientation,disableOrientation,recorder,advancedVision,externalSignals}),[status,enableAudio,enableAudioFile,disableAudio,enableCamera,disableCamera,enableAdvancedVision,disableAdvancedVision,enableMidi,enableOrientation,disableOrientation,recorder,advancedVision,externalSignals])
  return <Context.Provider value={api}>{children}</Context.Provider>
}
