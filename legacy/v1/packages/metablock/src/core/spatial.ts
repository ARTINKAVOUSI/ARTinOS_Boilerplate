import type { DockCandidate, Rect, WorkspaceZone } from './types.js';
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
export function dockFieldStrength(distance:number,radius=72,power=2){if(radius<=0||distance>=radius)return 0;return Math.pow(1-distance/radius,power)}
export function resolveDockCandidates(pointer:{x:number;y:number},{workspaceRect,targets=[],radius=72,velocity=0,modality='pointer'}:{workspaceRect:any;targets?:Array<{id:string;rect:any;mergeOnly?:boolean;splitOnly?:boolean;priority?:number;mergeIntent?:string;relation?:string}>;radius?:number;velocity?:number;modality?:string}):DockCandidate[]{
  if(!workspaceRect)return[];
  const size=modality==='touch'?radius*1.35:modality==='pen'?radius*.82:radius;
  const velocityFactor=velocity>1400?.42:velocity>900?.62:1;
  const candidates:DockCandidate[]=[];
  const edges:Array<[any,number]>=[['left',Math.abs(pointer.x-workspaceRect.left)],['right',Math.abs(workspaceRect.right-pointer.x)],['top',Math.abs(pointer.y-workspaceRect.top)],['bottom',Math.abs(workspaceRect.bottom-pointer.y)]];
  for(const[area,distance]of edges){const strength=dockFieldStrength(distance,size)*velocityFactor;if(strength>0)candidates.push({kind:'workspace-edge',area,distance,strength:strength*.96})}
  for(const target of targets){
    const r=target.rect,cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,w=Math.max(1,r.width??r.right-r.left),h=Math.max(1,r.height??r.bottom-r.top);
    const inside=pointer.x>=r.left&&pointer.x<=r.right&&pointer.y>=r.top&&pointer.y<=r.bottom;
    const local:Array<[any,number]>=[['left',Math.abs(pointer.x-r.left)],['right',Math.abs(r.right-pointer.x)],['top',Math.abs(pointer.y-r.top)],['bottom',Math.abs(r.bottom-pointer.y)]];
    const nearest=Math.min(...local.map(v=>v[1]));
    // Edge intent dominates near the edge; center merge progressively dominates toward the middle.
    const edgeBand=Math.max(28,Math.min(size*.72,Math.min(w,h)*.28));
    const priority=target.priority??0;
    if(!target.mergeOnly)for(const[area,distance]of local){const field=dockFieldStrength(distance,edgeBand);if(field>0)candidates.push({kind:'split',targetId:target.id,area,distance,strength:Math.min(1,(.58+field*.4)*velocityFactor+priority*.45),ratio:.36,relation:target.relation})}
    if(inside&&!target.splitOnly){
      const nx=Math.abs(pointer.x-cx)/(w*.5),ny=Math.abs(pointer.y-cy)/(h*.5),center=Math.max(0,1-Math.max(nx,ny));
      const edgeSuppression=clamp(nearest/edgeBand,0,1);
      const strength=Math.min(1,(.52+center*.43)*(.55+edgeSuppression*.45)+priority);
      candidates.push({kind:'merge',targetId:target.id,distance:Math.hypot(pointer.x-cx,pointer.y-cy),strength,intent:target.mergeIntent,relation:target.relation});
    }
  }
  return candidates.sort((a,b)=>b.strength-a.strength)
}
export function snapRect(rect:Rect,{workspaceRect=null,peers=[],threshold=12}:{workspaceRect?:any;peers?:Array<Rect&{id:string}>;threshold?:number}={}){let x=rect.x,y=rect.y;const guides:Array<{axis:'x'|'y';value:number;kind:string;peerId?:string;edge?:'left'|'right'|'top'|'bottom'}>=[];if(workspaceRect){if(Math.abs(x-workspaceRect.left)<threshold){x=workspaceRect.left;guides.push({axis:'x',value:x,kind:'edge',edge:'left'})}if(Math.abs(x+rect.width-workspaceRect.right)<threshold){x=workspaceRect.right-rect.width;guides.push({axis:'x',value:workspaceRect.right,kind:'edge',edge:'right'})}if(Math.abs(y-workspaceRect.top)<threshold){y=workspaceRect.top;guides.push({axis:'y',value:y,kind:'edge',edge:'top'})}if(Math.abs(y+rect.height-workspaceRect.bottom)<threshold){y=workspaceRect.bottom-rect.height;guides.push({axis:'y',value:workspaceRect.bottom,kind:'edge',edge:'bottom'})}}for(const p of peers){for(const[a,b,axis]of[[x,p.x,'x'],[x+rect.width,p.x+p.width,'x'],[y,p.y,'y'],[y+rect.height,p.y+p.height,'y']] as Array<[number,number,'x'|'y']>)if(Math.abs(a-b)<threshold){if(axis==='x')x+=b-a;else y+=b-a;guides.push({axis,value:b,kind:'peer',peerId:p.id})}}return{x,y,guides}}

/** A soft alignment candidate. It keeps the surface floating; it never mutates the layout graph. */
export function resolveWorkspaceSnapCandidate(rect:Rect,guides:Array<{kind:string;edge?:string}>=[]):DockCandidate|null{
  const guide=guides.find(g=>g.kind==='edge'&&g.edge);if(!guide?.edge)return null;
  return{kind:'workspace-snap',area:guide.edge as any,distance:0,strength:.32,ratio:0,intent:`SNAP ${String(guide.edge).toUpperCase()}`,relation:'snap'};
}
export function resolveZoneMode(zone:WorkspaceZone,{width,height,role='tool'}:{width?:number;height?:number;role?:string}={}){const a=zone.adaptive??{};if(width!=null&&a.compactWidth!=null&&width<a.compactWidth)return a.compactMode??'overlay';if(height!=null&&a.compactHeight!=null&&height<a.compactHeight)return a.compactMode??'overlay';const aspect=width&&height?width/height:1;if(a.wideAspect!=null&&aspect>=a.wideAspect)return a.wideMode??'bottom-dock';if(a.tallAspect!=null&&aspect<=a.tallAspect)return a.tallMode??'right-dock';if(role==='inspector'&&a.inspectorMode)return a.inspectorMode;if(role==='timeline'&&a.timelineMode)return a.timelineMode;return a.balancedMode??zone.modes?.[0]??'overlay'}

export interface DockIntentGateState { key:string|null; since:number; candidate:DockCandidate|null }
export function dockCandidateKey(candidate:DockCandidate|null){return candidate?`${candidate.kind}:${candidate.targetId??''}:${candidate.area??''}`:''}
export function stabilizeDockCandidate(candidate:DockCandidate|null,state:DockIntentGateState,{now=Date.now(),holdMs=72,minStrength=.34,instantStrength=.9}:{now?:number;holdMs?:number;minStrength?:number;instantStrength?:number}={}){
  if(!candidate||candidate.strength<minStrength)return{key:null,since:now,candidate:null} satisfies DockIntentGateState;
  const key=dockCandidateKey(candidate);
  if(key!==state.key)return{key,since:now,candidate:candidate.strength>=instantStrength?candidate:null} satisfies DockIntentGateState;
  if(candidate.strength>=instantStrength||now-state.since>=holdMs)return{key,since:state.since,candidate} satisfies DockIntentGateState;
  return{key,since:state.since,candidate:null} satisfies DockIntentGateState;
}
export function chooseDockCandidate(candidates:DockCandidate[]=[],previous:DockCandidate|null=null,{hysteresis=.12}={}){const best=candidates[0]??null;if(!previous||!best)return best;const same=candidates.find(c=>c.kind===previous.kind&&c.area===previous.area&&c.targetId===previous.targetId);if(!same)return best;return best.strength>same.strength+hysteresis?best:same}
export function resolveDockPreviewRect(candidate:DockCandidate|null,{workspaceRect,targetRects=new Map(),defaultRatio=.28}:{workspaceRect:any;targetRects?:Map<string,any>|Record<string,any>;defaultRatio?:number}):Rect|null{if(!candidate||!workspaceRect)return null;const wr=workspaceRect,width=wr.width??(wr.right-wr.left),height=wr.height??(wr.bottom-wr.top),originX=wr.left??0,originY=wr.top??0;if(candidate.kind==='workspace-edge'){const ratio=clamp(candidate.ratio??defaultRatio,.16,.42);if(candidate.area==='left')return{x:originX,y:originY,width:width*ratio,height};if(candidate.area==='right')return{x:originX+width*(1-ratio),y:originY,width:width*ratio,height};if(candidate.area==='top')return{x:originX,y:originY,width,height:height*ratio};if(candidate.area==='bottom')return{x:originX,y:originY+height*(1-ratio),width,height:height*ratio}}const target=targetRects instanceof Map?targetRects.get(candidate.targetId??''):(targetRects as any)?.[candidate.targetId??''];if(!target)return null;const tw=target.width??(target.right-target.left),th=target.height??(target.bottom-target.top),tx=target.left??target.x,ty=target.top??target.y;if(candidate.kind==='merge')return{x:tx,y:ty,width:tw,height:th};if(candidate.kind==='split'){const ratio=clamp(candidate.ratio??.36,.2,.5);if(candidate.area==='left')return{x:tx,y:ty,width:tw*ratio,height:th};if(candidate.area==='right')return{x:tx+tw*(1-ratio),y:ty,width:tw*ratio,height:th};if(candidate.area==='top')return{x:tx,y:ty,width:tw,height:th*ratio};if(candidate.area==='bottom')return{x:tx,y:ty+th*(1-ratio),width:tw,height:th*ratio}}return null}
export function dockIntentLabel(candidate:DockCandidate|null){if(!candidate)return'FREE';if(candidate.intent)return candidate.intent;if(candidate.kind==='merge')return'MERGE / GROUP';if(candidate.kind==='split')return`SPLIT ${String(candidate.area).toUpperCase()}`;if(candidate.kind==='workspace-edge')return`DOCK ${String(candidate.area).toUpperCase()}`;if(candidate.kind==='workspace-snap')return`SNAP ${String(candidate.area).toUpperCase()}`;return String(candidate.kind??'TARGET').toUpperCase()}
