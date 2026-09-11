import { useState } from 'react'
import { useArtinosRuntime, useParameter } from '@artinos/runtime'
import { Button, KeyValue, ParameterControl, QualityPanel, Section, Select, useTelemetry } from '../foundation'
import { defs } from '@artinos/modules'

export function RenderPanel(){
  const runtime=useArtinosRuntime(),metrics=useTelemetry(),[scale,setScale]=useState(1)
  const value=(id:string,fallback:unknown=0)=>metrics.find(m=>m.id===id)?.value??fallback
  const renderer=()=>runtime.resources.get<any>('three.renderer')
  const screenshot=()=>{const canvas=renderer()?.domElement as HTMLCanvasElement|undefined;if(!canvas)return;try{const link=document.createElement('a');link.download=`artinos-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;link.href=canvas.toDataURL('image/png');link.click();runtime.logger.info('Viewport screenshot exported',{source:'render'})}catch(error){runtime.logger.error(`Screenshot failed: ${String(error)}`,{source:'render'})}}
  const fullscreen=async()=>{const canvas=renderer()?.domElement as HTMLCanvasElement|undefined;if(!canvas)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await canvas.parentElement?.requestFullscreen?.()}catch(error){runtime.logger.warn(`Fullscreen request failed: ${String(error)}`,{source:'render'})}}
  const highResolution=async()=>{const instance=renderer(),canvas=instance?.domElement as HTMLCanvasElement|undefined;if(!instance||!canvas)return;const width=canvas.clientWidth,height=canvas.clientHeight,pixelRatio=instance.getPixelRatio?.()??devicePixelRatio;try{instance.setPixelRatio(pixelRatio*scale);instance.setSize(width,height,false);await new Promise(resolve=>window.setTimeout(resolve));screenshot()}finally{instance.setPixelRatio(pixelRatio);instance.setSize(width,height,false)}}
  return <>
    <Section title="Renderer" description="One shared ARTINOS / R3F WebGPU renderer">
      <P d={defs.renderPreset}/><P d={defs.shadowMap}/><P d={defs.toneMapping}/><P d={defs.outputColorSpace}/><P d={defs.exposure}/><P d={defs.clearAlpha}/>
      <KeyValue label="Backend" value={String(value('renderer.backend','initializing'))}/><KeyValue label="Requested" value={String(value('renderer.backend.requested','auto'))}/><KeyValue label="FPS" value={Number(value('performance.fps')).toFixed(1)}/><KeyValue label="Frame" value={`${Number(value('performance.frameMs')).toFixed(2)} ms`}/><KeyValue label="Draw Calls" value={String(value('renderer.calls'))}/><KeyValue label="Triangles" value={String(value('renderer.triangles'))}/><KeyValue label="Objects / Meshes / Lights" value={`${String(value('renderer.objects'))} / ${String(value('renderer.meshes'))} / ${String(value('renderer.lights'))}`}/><KeyValue label="Textures" value={String(value('renderer.textures'))}/><KeyValue label="Geometries" value={String(value('renderer.geometries'))}/><KeyValue label="PostFX" value={`${String(value('postfx.effects'))} effects`}/><KeyValue label="PostFX Cost" value={`${Number(value('performance.postfxMs')).toFixed(2)} ms`}/>
    </Section>
    <Section title="Canvas / Output" description="Capture or present the shared viewport without creating a second renderer."><Select label="Capture Scale" value={scale} options={[1,2,3,4].map(value=>({label:`${value}×`,value}))} onChange={setScale}/><div className="artinos-button-row"><Button onClick={screenshot}>Screenshot PNG</Button><Button onClick={highResolution}>Render {scale}× PNG</Button><Button onClick={fullscreen}>Toggle Fullscreen</Button></div><KeyValue label="Viewport" value={String(runtime.signals.get('viewport.size')??'waiting')}/></Section>
    <QualityPanel/>
  </>
}
function P({d}:{d:any}){const[v,setV]=useParameter(d);return <ParameterControl definition={d} value={v} onChange={setV as any}/>} 
