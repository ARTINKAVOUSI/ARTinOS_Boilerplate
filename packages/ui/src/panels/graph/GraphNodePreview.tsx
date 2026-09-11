import { memo } from 'react'
import { PREVIEW_H, PREVIEW_W } from './geometry'

export interface PreviewFrame{width:number;height:number;pixels:Uint8Array;updatedAt:number}
export interface NodePreviewService{request(key:string,node:unknown):void;release(key:string):void;get(key:string):PreviewFrame|undefined;subscribe(fn:()=>void):()=>void;revision:number}

const histories=new Map<string,number[]>(),HISTORY=64
export function sampleHistory(key:string,value:number){const list=histories.get(key)??[];if(list.length&&list.at(-1)===value&&list.length>2)return list;list.push(value);if(list.length>HISTORY)list.splice(0,list.length-HISTORY);histories.set(key,list);return list}
export const clearHistory=(key:string)=>{histories.delete(key)}

/** SVG keeps UI previews renderer-neutral; it never creates a second canvas. */
export const ValuePreview=memo(function ValuePreview({nodeKey,value,accent='#4ed6bd'}:{nodeKey:string;value:number;accent?:string}){
  const history=sampleHistory(nodeKey,value);if(history.length<2)return <svg className="artinos-gpreview-canvas" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} />
  let min=Math.min(...history),max=Math.max(...history);if(max-min<1e-6){min-=.5;max+=.5}const span=max-min
  const points=history.map((item,index)=>`${index/(history.length-1)*PREVIEW_W},${PREVIEW_H-((item-min)/span)*(PREVIEW_H-3)-1.5}`).join(' ')
  return <svg className="artinos-gpreview-canvas" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none"><line x1="0" x2={PREVIEW_W} y1={PREVIEW_H/2} y2={PREVIEW_H/2} stroke="currentColor" opacity=".12"/><polygon points={`0,${PREVIEW_H} ${points} ${PREVIEW_W},${PREVIEW_H}`} fill={accent} opacity=".16"/><polyline points={points} fill="none" stroke={accent} strokeWidth="1" vectorEffect="non-scaling-stroke"/></svg>
})

/** Downsampled runtime readback, displayed as SVG cells without renderer ownership. */
export const RenderPreview=memo(function RenderPreview({nodeKey,frame}:{nodeKey:string;frame?:PreviewFrame}){
  if(!frame)return <div className="artinos-gpreview-pending" style={{width:PREVIEW_W,height:PREVIEW_H}}>compiling…</div>
  const columns=Math.min(40,frame.width),rows=Math.min(22,frame.height),cellW=PREVIEW_W/columns,cellH=PREVIEW_H/rows,cells=[]
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const sx=Math.floor(x/columns*frame.width),sy=Math.floor((rows-1-y)/rows*frame.height),index=(sy*frame.width+sx)*4,r=frame.pixels[index]??0,g=frame.pixels[index+1]??0,b=frame.pixels[index+2]??0,a=(frame.pixels[index+3]??255)/255;cells.push(<rect key={`${x}:${y}`} x={x*cellW} y={y*cellH} width={cellW+.2} height={cellH+.2} fill={`rgba(${r},${g},${b},${a})`}/>) }
  return <svg key={nodeKey} className="artinos-gpreview-canvas is-render" viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`} preserveAspectRatio="none" shapeRendering="crispEdges">{cells}</svg>
})
