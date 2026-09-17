import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import * as TSL from 'three/tsl'
import { afterImage } from 'three/addons/tsl/display/AfterImageNode.js'
import { bleach } from 'three/addons/tsl/display/BleachBypass.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { boxBlur } from 'three/addons/tsl/display/boxBlur.js'
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js'
import { colorBleeding, scanlines, vignette } from 'three/addons/tsl/display/CRT.js'
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js'
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js'
import { film } from 'three/addons/tsl/display/FilmNode.js'
import { fsr1 } from 'three/addons/tsl/display/FSR1Node.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { hashBlur } from 'three/addons/tsl/display/hashBlur.js'
import { lensflare } from 'three/addons/tsl/display/LensflareNode.js'
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js'
import { outline } from 'three/addons/tsl/display/OutlineNode.js'
import { rgbShift } from 'three/addons/tsl/display/RGBShiftNode.js'
import { sepia } from 'three/addons/tsl/display/Sepia.js'
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'
import { sobel } from 'three/addons/tsl/display/SobelOperatorNode.js'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import { ssr } from 'three/addons/tsl/display/SSRNode.js'
import { taau } from 'three/addons/tsl/display/TAAUNode.js'
import { traa } from 'three/addons/tsl/display/TRAANode.js'
import { ssaaPass } from 'three/addons/tsl/display/SSAAPassNode.js'
import { sss } from 'three/addons/tsl/display/SSSNode.js'
import { godrays } from 'three/addons/tsl/display/GodraysNode.js'
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js'
import { transition } from 'three/addons/tsl/display/TransitionNode.js'
import { pixelationPass } from 'three/addons/tsl/display/PixelationPassNode.js'
import { retroPass } from 'three/addons/tsl/display/RetroPassNode.js'
import { radialBlur } from 'three/addons/tsl/display/radialBlur.js'
import { bilateralBlur } from 'three/addons/tsl/display/BilateralBlurNode.js'
import { recurrentDenoise } from 'three/addons/tsl/display/RecurrentDenoiseNode.js'
import { configureScenePasses, isTransmissionGlass } from './scene-pass-filter'
import { useArtinosRuntime } from './runtime'
import { resolvePostFXCapability, SSGI_TIER_SAMPLING, usePostFXController, TRANSMISSION_BACKDROP_RESOURCE, type PostFXEffect, type PostFXRuntimeState } from './postfx'

const nodes = TSL as Record<string, any>
const { float, mrt, normalView, output, pass, posterize, vec2, vec4, velocity, grayscale, hue, saturation, packNormalToRGB, diffuseColor } = nodes

const n=(p:Record<string,number|boolean>|undefined,key:string,fallback:number)=>typeof p?.[key]==='number'?p[key] as number:fallback
const b=(p:Record<string,number|boolean>|undefined,key:string,fallback=false)=>typeof p?.[key]==='boolean'?p[key] as boolean:fallback
/** Effects that read the scene pass normal / velocity attachments. Anything not listed here runs
 *  off the beauty buffer alone, so the pass can skip MRT entirely and keep scene.background. */
const MRT_NORMAL=new Set(['ssr','ssgi','gtao','denoise','recurrentDenoise']);
const MRT_VELOCITY=new Set(['traa','taau','motionBlur']);
const disposePostFXTree=(root:any,scenePass:any,backdropPass:any,cleanPass:any)=>{const disposed=new Set<any>();root?.traverse?.((node:any)=>{if(node===scenePass||node===backdropPass||node===cleanPass||disposed.has(node))return;disposed.add(node);node.dispose?.()})}

export function RenderPipelineSystem(){
  const controller=usePostFXController(),runtime=useArtinosRuntime(),renderer=useThree((s:any)=>s.renderer??s.gl),scene=useThree((s:any)=>s.scene),camera=useThree((s:any)=>s.camera),setThree=useThree((s:any)=>s.set),size=useThree((s:any)=>s.size)
  useSyncExternalStore(controller.subscribe,()=>controller.revision,()=>0);const quality=useSyncExternalStore(runtime.quality.subscribe,runtime.quality.getState,runtime.quality.getState)
  const effectsKey=JSON.stringify(controller.snapshot())
  const effects=useMemo<PostFXEffect[]>(()=>JSON.parse(effectsKey),[effectsKey])
  const needsNormal=controller.enabled&&effects.some(e=>MRT_NORMAL.has(e.type)),needsVelocity=controller.enabled&&effects.some(e=>MRT_VELOCITY.has(e.type)),needsPackedNormal=controller.enabled&&effects.some(e=>e.type==='recurrentDenoise'),needsDiffuse=controller.enabled&&effects.some(e=>e.type==='ssgi'&&e.enabled!==false)
  const state=useMemo(()=>{
    const pipeline=new (THREE as any).RenderPipeline(renderer);const scenePass:any=pass(scene,camera)
    // Attachment layout is immutable for this pass lifetime. Reusing a target after MRT
    // toggles leaves orphan attachments and incompatible cached GPU render pipelines.
    scenePass.setMRT(needsNormal||needsVelocity?mrt({output,...(needsNormal?{normal:normalView}:null),...(needsPackedNormal?{normalPacked:packNormalToRGB(normalView)}:null),...(needsVelocity?{velocity}:null),...(needsDiffuse?{diffuseColor}:null)}):null)
    // SSGI only needs albedo at 8-bit precision
    if(needsDiffuse){try{scenePass.getTexture('diffuseColor').type=THREE.UnsignedByteType}catch{/* optional */}}
    const backdropPass:any=pass(scene,camera)
    backdropPass.renderTarget.texture.generateMipmaps=true
    backdropPass.renderTarget.texture.minFilter=THREE.LinearMipmapLinearFilter
    scenePass.name='Scene / Beauty'
    backdropPass.name='Glass / Backdrop'
    const cleanPass:any=pass(scene,camera)
    cleanPass.name='Glass / Clean'
    cleanPass.renderTarget.texture.generateMipmaps=true
    cleanPass.renderTarget.texture.minFilter=THREE.LinearMipmapLinearFilter
    configureScenePasses(scenePass,backdropPass,scene,cleanPass)
    return{pipeline,scenePass,backdropPass,cleanPass}
  },[renderer,scene,camera,needsNormal,needsVelocity,needsPackedNormal,needsDiffuse])
  const monitorElapsed=useRef(0)
  useFrame((_frame,delta)=>{
    monitorElapsed.current+=delta
    if(monitorElapsed.current<.25)return
    monitorElapsed.current=0
    let meshes=0,taps=0,backs=false,spectral=false
    scene.traverseVisible((object:any)=>{
      if(!isTransmissionGlass(object))return
      meshes++
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material.isTransmissionGlassMaterial)continue
        taps=Math.max(taps,material.transmissionSampleTaps??0)
        spectral ||= !!material.transmissionSpectral
        backs ||= !!material.transmissionBackdropConfig?.backside
      }
    })
    const resolution=(p:any)=>p.renderTarget.width+'×'+p.renderTarget.height
    runtime.telemetry.setMany([
      {id:'glass.meshes',value:meshes,options:{group:'glass'}},
      {id:'glass.taps',value:taps,options:{group:'glass'}},
      {id:'glass.mode',value:meshes?(spectral?'Spectral':'RGB'):'inactive',options:{group:'glass'}},
      {id:'glass.backdropResolution',value:meshes?resolution(state.backdropPass):'inactive',options:{group:'glass'}},
      {id:'glass.cleanResolution',value:meshes&&backs?resolution(state.cleanPass):'bypassed',options:{group:'glass'}},
      {id:'glass.captureCpuMs',value:meshes?(state.backdropPass.captureCpuMs??0):0,options:{group:'glass',unit:'ms'}},
    ])
  })
  useEffect(()=>{
    let current:any=state.scenePass.toInspector?.('Pass / Scene / Beauty')??state.scenePass;
    const depth=state.scenePass.getTextureNode('depth').toInspector?.('Pass / Scene / Depth')??state.scenePass.getTextureNode('depth'),viewZ=state.scenePass.getViewZNode(),normal=needsNormal?(state.scenePass.getTextureNode('normal').toInspector?.('Pass / Scene / Normal')??state.scenePass.getTextureNode('normal')):null,vel=needsVelocity?(state.scenePass.getTextureNode('velocity').toInspector?.('Pass / Scene / Velocity')??state.scenePass.getTextureNode('velocity')):null,backend=renderer.backend?.isWebGLBackend===true?'webgl2':'webgpu',runtimeStates:PostFXRuntimeState[]=[],resolvedEffects:PostFXEffect[]=[];for(const effect of effects){const capability=controller.enabled?resolvePostFXCapability(effect,backend,quality.tier,id=>runtime.resources.get(id)!=null):{state:'disabled' as const};runtimeStates.push({id:effect.id,type:effect.type,...capability,backend,tier:quality.tier});if(capability.state==='active')resolvedEffects.push(effect);else if(capability.state==='fallback'&&capability.fallback)resolvedEffects.push({...effect,type:capability.fallback,resources:[],minTier:'low',fallback:'disable',supportedBackend:'both'});}controller.setRuntimeStates(runtimeStates);for(const effect of resolvedEffects){const p=effect.params;switch(effect.type){case'bloom':current=current.add(bloom(current,n(p,'strength',1),n(p,'radius',.25),n(p,'threshold',.8)));break;case'dof':current=dof(current,viewZ,n(p,'focusDistance',4),n(p,'focalLength',.02),n(p,'bokehScale',2));break;case'afterImage':current=afterImage(current,n(p,'damp',.96));break;case'anamorphic':current=current.add(bloom(current,n(p,'scale',3),.9,n(p,'threshold',.9)));break;case'chromaticAberration':current=chromaticAberration(current,float(n(p,'strength',.004)));break;case'dotScreen':current=dotScreen(current,n(p,'angle',1.57),n(p,'scale',1));break;case'film':current=film(current,n(p,'intensity',.12) as any);break;case'fxaa':current=fxaa(current);break;case'rgbShift':current=rgbShift(current,n(p,'amount',.003),n(p,'angle',0));break;case'smaa':current=smaa(current);break;case'sobel':current=sobel(current);break;case'sepia':current=sepia(current);break;case'grayscale':current=grayscale(current);break;case'motionBlur':current=motionBlur(current,vel,n(p,'samples',16) as any);break;case'ssr':current=ssr(current,depth,normal,{camera,stochastic:b(p,'stochastic',true),binaryRefine:b(p,'binaryRefine',true)} as any);break;case'ssgi':{
      // SSGI outputs raw GI (rgb) + AO (a); it must be composited: beauty·AO + albedo·GI.
      const gi:any=ssgi(current,depth,normal,camera),sampling=SSGI_TIER_SAMPLING[quality.tier]??SSGI_TIER_SAMPLING.balanced
      gi.sliceCount.value=sampling.slices;gi.stepCount.value=sampling.steps
      gi.giIntensity.value=n(p,'giIntensity',9);gi.aoIntensity.value=n(p,'aoIntensity',1);gi.radius.value=n(p,'radius',10);gi.thickness.value=n(p,'thickness',1);gi.expFactor.value=n(p,'expFactor',2);gi.backfaceLighting.value=n(p,'backfaceLighting',0);gi.useTemporalFiltering=b(p,'temporal',true)
      const albedo=needsDiffuse?state.scenePass.getTextureNode('diffuseColor'):current
      // the AO attachment is single-channel: sample .r, never the vec4
      current=vec4(current.rgb.mul(gi.getAONode().r).add(albedo.rgb.mul(gi.getGINode().rgb)),current.a)
      break}case'gtao':current=vec4(current.rgb.mul(ao(depth,normal,camera).r),current.a);break;case'traa':current=traa(current,depth,vel,camera);break;case'taau':current=taau(current,depth,vel,camera);break;case'bleach':current=bleach(current,n(p,'opacity',.5) as any);break;case'gaussianBlur':current=gaussianBlur(current,vec2(n(p,'radius',3)),n(p,'sigma',2));break;case'hashBlur':current=hashBlur(current,n(p,'amount',.08) as any,{repeats:n(p,'repeats',32)} as any);break;case'sharpen':current=sharpen(current,n(p,'sharpness',.35) as any,b(p,'denoise',false) as any);break;case'fsr1':current=fsr1(current,n(p,'sharpness',.2) as any,b(p,'denoise',false) as any);break;case'vignette':current=vec4(vignette(current.rgb,n(p,'intensity',.35) as any,n(p,'smoothness',.55) as any),current.a);break;case'boxBlur':current=boxBlur(current,{size:n(p,'size',1),separation:n(p,'separation',1),premultipliedAlpha:b(p,'premultipliedAlpha',false)} as any);break;case'denoise':current=denoise(current,depth,normal,camera);break;case'lensflare':current=current.add(lensflare(current,{threshold:n(p,'threshold',.5),ghostSamples:n(p,'ghostSamples',4),ghostSpacing:n(p,'ghostSpacing',.25),ghostAttenuationFactor:n(p,'ghostAttenuationFactor',25),downSampleRatio:n(p,'downSampleRatio',4)} as any));break;case'outline':{const selectedObjects=runtime.resources.get<any[]>('selection.objects')??[];if(selectedObjects.length)current=current.add(outline(scene,camera,{selectedObjects,edgeThickness:n(p,'edgeThickness',1),edgeGlow:n(p,'edgeGlow',0),downSampleRatio:n(p,'downSampleRatio',2)} as any));break}case'posterize':current=posterize(current,n(p,'steps',8) as any);break;case'colorBleeding':current=vec4(colorBleeding(current.rgb,n(p,'amount',.002) as any),current.a);break;case'scanlines':current=vec4(scanlines(current.rgb,n(p,'intensity',.3) as any,n(p,'count',240) as any,n(p,'speed',0) as any),current.a);break;case'hue':current=vec4(hue(current.rgb,n(p,'adjustment',0) as any),current.a);break;case'saturation':current=vec4(saturation(current.rgb,n(p,'adjustment',1) as any),current.a);break;case'ssaa':{const node:any=ssaaPass(scene,camera);current=node.getTextureNode?.('output')??node;break}case'sss':{const light=runtime.resources.get<any>('scene.mainLight');if(light)current=current.add(sss(depth,camera,light));break}case'godrays':{const light=runtime.resources.get<any>('scene.godraysLight');if(light)current=current.add(godrays(depth,camera,light));break}case'lut3d':{const lut=runtime.resources.get<any>('postfx.lut3d');if(lut)current=lut3D(current,lut,lut.image?.width??32,float(n(p,'intensity',1)));break}case'transition':{const resource=runtime.resources.get<any>('postfx.transition');if(resource?.node&&resource?.mixTexture)current=transition(current,resource.node,resource.mixTexture,float(n(p,'mix',0)),float(.1),float(1));break}case'pixelation':{const node:any=pixelationPass(scene,camera,n(p,'pixelSize',6),n(p,'normalEdge',.3),n(p,'depthEdge',.4));current=node.getTextureNode?.('output')??node;break}case'retro':{const node:any=retroPass(scene,camera);current=node.getTextureNode?.('output')??node;break}case'radialBlur':current=radialBlur(current,{strength:n(p,'strength',.2)} as any);break;case'bilateralBlur':current=bilateralBlur(current,vec2(1,0),float(n(p,'sigma',2)),float(n(p,'sigmaColor',.1)));break;case'recurrentDenoise':current=recurrentDenoise(current,camera,{depthNode:depth,normalNode:state.scenePass.getTextureNode('normalPacked')} as any);break;default:break}current=current.toInspector?.(`PostFX / ${effect.type}`)??current}
    // Preserve background and partial coverage. Depth cannot distinguish a sky/background
    // from empty canvas, and brightness is not opacity.
    const backdropSampler=state.backdropPass.getTextureNode()
    const outputNode=vec4(current.rgb,state.scenePass.getTextureNode().a)
    state.pipeline.outputNode=outputNode;state.pipeline.needsUpdate=true;setThree({postProcessing:state.pipeline,passes:{scene:state.scenePass}});runtime.telemetry.set('postfx.effects',runtimeStates.filter(effect=>effect.state==='active'||effect.state==='fallback').length,{group:'postfx'});runtime.telemetry.set('postfx.enabled',controller.enabled,{group:'postfx'});const clean=[runtime.resources.set('render.pipeline',state.pipeline),runtime.resources.set('render.scenePass',state.scenePass),runtime.resources.set(TRANSMISSION_BACKDROP_RESOURCE,backdropSampler),runtime.resources.set('render.transmissionCleanBackdrop',state.cleanPass.getTextureNode()),runtime.resources.set('render.transmissionBackdropPass',state.backdropPass),runtime.resources.set('render.output',outputNode),runtime.resources.set('render.depth',depth),runtime.resources.set('render.normal',normal),runtime.resources.set('render.velocity',vel),runtime.resources.set('postfx.controller',controller),runtime.quality.register('render.postfx',next=>runtime.telemetry.set('postfx.quality',`${next.tier}:${next.scalar.toFixed(2)}`,{group:'quality'}))];return()=>{setThree((three:any)=>three.postProcessing===state.pipeline?{postProcessing:null,passes:{}}:{});clean.forEach(fn=>fn());disposePostFXTree(outputNode,state.scenePass,state.backdropPass,state.cleanPass);(state.pipeline as any)._quadMesh?.material?.dispose?.()}},[effects,state,runtime,camera,scene,controller,controller.enabled,setThree,quality,size.width,size.height])
  useEffect(()=>()=>{state.scenePass.dispose();state.backdropPass.dispose();state.cleanPass.dispose();state.pipeline.dispose?.()},[state])
  return null
}

