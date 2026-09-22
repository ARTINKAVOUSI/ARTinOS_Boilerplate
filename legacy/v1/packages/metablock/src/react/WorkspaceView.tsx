import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { MetaBlockWorkspace } from '../core/workspace.js';
import type { DockArea, DockCandidate, MetaBlockGroup, MetaBlockInstance, MetaBlockMotionConfig, Rect } from '../core/types.js';
import { defaultMetaBlockMotionConfig } from '../core/types.js';
import { magneticOffset, resolveKineticPose, resolveSettleCurve, resolveSettleDuration, type MetaBlockKineticPose } from '../core/physics.js';
import { chooseDockCandidate, dockIntentLabel, resolveDockCandidates, resolveDockPreviewRect, resolveWorkspaceSnapCandidate, resolveZoneMode, snapRect, stabilizeDockCandidate, type DockIntentGateState } from '../core/spatial.js';
import { resolveWorkspaceRects, resolveZoneRect } from '../core/layout.js';
import { useWorkspaceRevision } from './hooks.js';
import { MetaBlockBody } from './BlockBody.js';

const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const rect=(x:number,y:number,width:number,height:number):Rect=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
const zeroPose:MetaBlockKineticPose={translateX:0,translateY:0,rotate:0,scale:1,lift:0,energy:0,field:0};

type BlockActions={
  float:(blockId:string)=>void;
  returnHome:(blockId:string)=>void;
  snap:(blockId:string,edge:Exclude<DockArea,'center'>)=>void;
  dock:(blockId:string,area:DockArea,targetGroupId?:string|null)=>void;
  split:(blockId:string,targetGroupId:string,area:DockArea)=>void;
  merge:(blockId:string,targetGroupId:string)=>void;
  pin:(blockId:string,edge:Exclude<DockArea,'center'>,autoHide?:boolean)=>void;
  popout:(blockId:string)=>void;
  maximize:(blockId:string)=>void;
  restore:(blockId:string)=>void;
  close:(blockId:string)=>void;
};
export interface GroupChromeContext {
  group:MetaBlockGroup;
  blocks:MetaBlockInstance[];
  activeBlock:MetaBlockInstance|null;
  activateBlock:(blockId:string)=>void;
  blockProps:(blockId:string)=>Record<string,any>;
  dragHandleProps:Record<string,any>;
  blockActions:BlockActions;
  maximize:()=>void;
  restore:()=>void;
  float:()=>void;
  close:()=>void;
  /** compatibility aliases */
  panels:MetaBlockInstance[];
  activePanel:MetaBlockInstance|null;
  activatePanel:(blockId:string)=>void;
  tabProps:(blockId:string)=>Record<string,any>;
  panelActions:BlockActions;
}
export interface MetaBlockContextMenuItem {
  id:string;label:string;detail?:string;shortcut?:string;disabled?:boolean;primary?:boolean;danger?:boolean;checked?:boolean;onSelect:()=>void;
}
export interface MetaBlockContextMenuSection { id:string;label?:string;layout?:'list'|'grid';items:MetaBlockContextMenuItem[] }
export interface MetaBlockContextMenuModel { title:string;subtitle:string;meta:string;sections:MetaBlockContextMenuSection[] }
export interface MetaBlockContextMenuRenderContext { x:number;y:number;model:MetaBlockContextMenuModel;close:()=>void }

export interface MetaBlockWorkspaceViewProps {
  workspace:MetaBlockWorkspace;
  renderBlock?:(block:MetaBlockInstance,group:MetaBlockGroup)=>ReactNode;
  /** @deprecated use renderBlock */
  renderPanel?:(block:MetaBlockInstance,group:MetaBlockGroup)=>ReactNode;
  renderGroupChrome?:(context:GroupChromeContext)=>ReactNode;
  renderGroupFooter?:(group:MetaBlockGroup)=>ReactNode;
  /** Package-rendered toolbar strip above a child MetaBlock body, outside its scroll area. */
  renderBlockToolbar?:(block:MetaBlockInstance,group:MetaBlockGroup)=>ReactNode;
  renderContextMenu?:(context:MetaBlockContextMenuRenderContext)=>ReactNode;
  className?:string;
  padding?:number;
  gap?:number;
  dockRadius?:number;
  snap?:number;
  dockRatio?:number;
  splitRatio?:number;
  hysteresis?:number;
  intentHoldMs?:number;
  previewStrength?:number;
  commitStrength?:number;
  liveDocking?:boolean;
  showDockCompass?:boolean;
  showSmartGuides?:boolean;
  motion?:Partial<MetaBlockMotionConfig>;
  onEvent?:(event:any)=>void;
}

type DragState={groupId:string;pointerId:number;startX:number;startY:number;startT:number;grabX:number;grabY:number;started:boolean;lastX:number;lastY:number;lastT:number;rawCandidate:DockCandidate|null;candidate:DockCandidate|null;commitCandidate:DockCandidate|null;gate:DockIntentGateState;originRect:Rect;currentRect:Rect;floatWidth:number;floatHeight:number;morphToFloat:boolean};
type BlockDragState={blockId:string;sourceGroupId:string;sourceIndex:number;pointerId:number;startX:number;startY:number;startT:number;lastX:number;lastY:number;lastT:number;started:boolean;rawCandidate:DockCandidate|null;candidate:DockCandidate|null;commitCandidate:DockCandidate|null;gate:DockIntentGateState;ghost:Rect;originVisual:Rect;floatWidth:number;floatHeight:number};
type ResizeEdge='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
type ResizeState={groupId:string;pointerId:number;edge:ResizeEdge;startX:number;startY:number;x:number;y:number;width:number;height:number};
type ResizeGuide={groupId:string;edge:ResizeEdge;rect:Rect}|null;
type InteractionState={candidate:DockCandidate|null;commitCandidate:DockCandidate|null;armed:boolean;guides:any[];intent:string;kind:'group'|'block'|null;ghost:Rect|null;dragRect:Rect|null;blockId:string|null;sourceGroupId:string|null;dragGroupId:string|null;pointer:{x:number;y:number}|null;pose:MetaBlockKineticPose;velocity:number};
type ContextMenuState={x:number;y:number;blockId:string|null;groupId:string;scope:'block'|'group'}|null;
const emptyInteraction:InteractionState={candidate:null,commitCandidate:null,armed:false,guides:[],intent:'FREE',kind:null,ghost:null,dragRect:null,blockId:null,sourceGroupId:null,dragGroupId:null,pointer:null,pose:zeroPose,velocity:0};

function preferredFloatingSize(block:MetaBlockInstance,source:Rect,workspace:{width:number;height:number}){
  const explicit=block.meta?.preferredFloatingSize??block.meta?.floatingSize??{};
  const role=String(block.role||'panel').toLowerCase();
  const fallback=role.includes('timeline')?{width:640,height:260}:role.includes('inspector')?{width:380,height:440}:role.includes('browser')?{width:460,height:420}:role.includes('viewport')?{width:560,height:360}:{width:400,height:320};
  // Source geometry is only a hint. Wide/fullscreen docks must never become the detached panel's default size.
  const hintedW=source.width>240&&source.width<620?source.width:fallback.width;
  const hintedH=source.height>160&&source.height<520?source.height:fallback.height;
  const width=clamp(Number(explicit.width??hintedW),260,Math.max(280,Math.min(620,workspace.width-28)));
  const height=clamp(Number(explicit.height??hintedH),180,Math.max(200,Math.min(520,workspace.height-28)));
  return{width,height};
}

export function MetaBlockWorkspaceView({
  workspace,renderBlock,renderPanel,renderGroupChrome,renderGroupFooter,renderBlockToolbar,renderContextMenu,className='',padding=0,gap=0,dockRadius=64,snap=14,
  dockRatio=.28,splitRatio=.36,hysteresis=.14,intentHoldMs=72,previewStrength=.34,commitStrength=.46,liveDocking=true,showDockCompass=true,showSmartGuides=true,motion={},onEvent
}:MetaBlockWorkspaceViewProps){
  useWorkspaceRevision(workspace);
  const renderContent=renderBlock??renderPanel;
  if(!renderContent)throw new Error('MetaBlockWorkspaceView requires renderBlock');
  const motionConfig:MetaBlockMotionConfig={...defaultMetaBlockMotionConfig,...motion};
  const rootRef=useRef<HTMLDivElement|null>(null),dragRef=useRef<DragState|null>(null),blockDragRef=useRef<BlockDragState|null>(null),resizeRef=useRef<ResizeState|null>(null);
  const frameRef=useRef<number|null>(null),pendingInteraction=useRef<InteractionState|null>(null);
  const[size,setSize]=useState({width:1,height:1}),[interaction,setInteraction]=useState<InteractionState>(emptyInteraction),[contextMenu,setContextMenu]=useState<ContextMenuState>(null),[resizeGuide,setResizeGuide]=useState<ResizeGuide>(null);

  useLayoutEffect(()=>{const root=rootRef.current;if(!root)return;const update=()=>setSize({width:root.clientWidth||1,height:root.clientHeight||1});update();const ro=new ResizeObserver(update);ro.observe(root);return()=>ro.disconnect()},[]);
  useEffect(()=>()=>{if(frameRef.current!=null)cancelAnimationFrame(frameRef.current)},[]);
  useEffect(()=>{if(!contextMenu)return;const close=()=>setContextMenu(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('pointerdown',close);window.addEventListener('blur',close);window.addEventListener('resize',close);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('blur',close);window.removeEventListener('resize',close);window.removeEventListener('keydown',key)}},[contextMenu]);

  const scheduleInteraction=(next:InteractionState)=>{pendingInteraction.current=next;if(frameRef.current!=null)return;frameRef.current=requestAnimationFrame(()=>{frameRef.current=null;if(pendingInteraction.current)setInteraction(pendingInteraction.current)})};
  const clearInteraction=()=>{pendingInteraction.current=null;if(frameRef.current!=null){cancelAnimationFrame(frameRef.current);frameRef.current=null}setInteraction(emptyInteraction)};
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key!=='Escape'||(!dragRef.current&&!blockDragRef.current))return;dragRef.current=null;blockDragRef.current=null;clearInteraction();onEvent?.({type:'drag:cancel'})};const blur=()=>{if(!dragRef.current&&!blockDragRef.current)return;dragRef.current=null;blockDragRef.current=null;clearInteraction();onEvent?.({type:'drag:cancel',reason:'blur'})};window.addEventListener('keydown',cancel);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',cancel);window.removeEventListener('blur',blur)}},[onEvent]);
  const workspaceRect=useMemo(()=>rect(padding,padding,Math.max(0,size.width-padding*2),Math.max(0,size.height-padding*2)),[size,padding]);
  const dockRects=useMemo(()=>resolveWorkspaceRects(workspace,{width:size.width,height:size.height,padding,gap}),[workspace,workspace.revision,size.width,size.height,padding,gap]);

  function localPoint(clientX:number,clientY:number){const b=rootRef.current?.getBoundingClientRect();return{x:clientX-(b?.left??0),y:clientY-(b?.top??0)}}
  function getRectForGroup(groupId:string):Rect|null{
    const group=workspace.groups.get(groupId);if(!group||(group.meta?.visible??true)===false||group.posture==='popout')return null;
    if(group.lockedFullscreen||group.posture==='fullscreen-locked'||group.posture==='maximized')return rect(0,0,size.width,size.height);
    if(group.posture==='floating'){const f=workspace.floating.get(groupId);return f?rect(f.x,f.y,f.width,f.height):null}
    if(group.posture==='pinned'||group.posture==='auto-hide'){const e=workspace.edgeSurfaces.get(groupId);if(!e)return null;const ratio=clamp(e.size,.08,.6);if(e.edge==='left')return rect(0,0,size.width*ratio,size.height);if(e.edge==='right')return rect(size.width*(1-ratio),0,size.width*ratio,size.height);if(e.edge==='top')return rect(0,0,size.width,size.height*ratio);return rect(0,size.height*(1-ratio),size.width,size.height*ratio)}
    if(group.posture==='zone'){
      const zone=[...workspace.zones.values()].find(z=>z.groups.includes(groupId));if(!zone)return null;
      const zr=resolveZoneRect(zone,workspaceRect),mode=zone.modeByGroup[groupId]==='auto'?resolveZoneMode(zone,{width:zr.width,height:zr.height,role:group.role}):zone.modeByGroup[groupId];
      const inset=group.meta?.edgeInset??{},ix=inset.left??0,iy=inset.top??0,ir=inset.right??0,ib=inset.bottom??0,inner=rect(zr.x+ix,zr.y+iy,Math.max(0,zr.width-ix-ir),Math.max(0,zr.height-iy-ib)),ratio=clamp(Number(group.meta?.zoneSize??.3),.12,.72);
      if(mode==='bottom-dock')return rect(inner.x,inner.y+inner.height*(1-ratio),inner.width,inner.height*ratio);
      if(mode==='top-dock')return rect(inner.x,inner.y,inner.width,inner.height*ratio);
      if(mode==='left-dock')return rect(inner.x,inner.y,inner.width*ratio,inner.height);
      if(mode==='right-dock')return rect(inner.x+inner.width*(1-ratio),inner.y,inner.width*ratio,inner.height);
      if(mode==='floating'){const f=workspace.floating.get(groupId);return f?rect(f.x,f.y,f.width,f.height):rect(inner.x+inner.width*.62,inner.y+inner.height*.08,inner.width*.32,inner.height*.42)}
      return rect(inner.x+inner.width*.06,inner.y+inner.height*.60,inner.width*.88,inner.height*.34)
    }
    return dockRects.get(groupId)??null;
  }

  const targetRects=useMemo(()=>new Map([...workspace.groups.keys()].map(id=>[id,getRectForGroup(id)]).filter((entry):entry is [string,Rect]=>Boolean(entry[1]))),[workspace.revision,size.width,size.height,padding,gap]);
  const peerRects=(excludeId:string)=>[...workspace.groups.values()].filter(g=>g.id!==excludeId&&!g.lockedFullscreen&&(g.meta?.visible??true)!==false&&g.capabilities.acceptsDrop!==false&&g.posture!=='popout').map(g=>{const r=getRectForGroup(g.id);return r?{id:g.id,...r}:null}).filter(Boolean) as Array<Rect&{id:string}>;
  const browserTargets=(excludeId:string)=>{
    const source=workspace.groups.get(excludeId),single=source?.children.length===1?source.children[0]:null,home=single?workspace.getBlockReturnState(single):null;
    return peerRects(excludeId).map(p=>{const target=workspace.groups.get(p.id),isHome=p.id===home?.sourceGroupId,isDock=target?.role==='dock';return{id:p.id,mergeOnly:isHome||isDock,priority:isHome?.18:isDock?.09:0,relation:isHome?'home':isDock?'dock':'group',mergeIntent:isHome?'ATTACH BACK TO PARENT':isDock?'ATTACH TO DOCK':'GROUP / MERGE',rect:{left:p.x,top:p.y,right:p.x+p.width,bottom:p.y+p.height,width:p.width,height:p.height}}});
  };
  const browserTargetsForBlock=(sourceGroupId:string,blockId:string)=>{const home=workspace.getBlockReturnState(blockId);return[...workspace.groups.values()].filter(g=>!g.lockedFullscreen&&(g.meta?.visible??true)!==false&&g.capabilities.acceptsDrop!==false&&g.posture!=='popout').map(g=>{const r=getRectForGroup(g.id);if(!r)return null;const isHome=g.id===home?.sourceGroupId,isSource=g.id===sourceGroupId,isDock=g.role==='dock',canSplitSource=isSource&&g.children.length>1&&g.capabilities.splittable!==false;return{id:g.id,mergeOnly:!canSplitSource&&(isSource||isHome||isDock),priority:canSplitSource?.18:isHome?.16:isDock?.10:0,relation:isSource?'source':isHome?'home':isDock?'dock':'group',mergeIntent:isSource?'KEEP AS TAB':isHome?'ATTACH BACK TO PARENT':isDock?'ATTACH TO DOCK':'GROUP / MERGE',rect:{left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height,width:r.width,height:r.height}}}).filter(Boolean) as Array<{id:string;mergeOnly?:boolean;priority?:number;relation?:string;mergeIntent?:string;rect:any}>};
  const previewFor=(candidate:DockCandidate|null)=>candidate?resolveDockPreviewRect(candidate,{workspaceRect:{left:workspaceRect.x,top:workspaceRect.y,right:workspaceRect.x+workspaceRect.width,bottom:workspaceRect.y+workspaceRect.height,width:workspaceRect.width,height:workspaceRect.height},targetRects,defaultRatio:dockRatio}):null;

  const beginGroupDrag=(event:PointerEvent<HTMLElement>,groupId:string)=>{
    if(event.button!==0||(event.target as Element).closest('button,input,select,textarea,a,[data-no-drag]'))return;
    const group=workspace.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.movable===false)return;
    const current=getRectForGroup(groupId);if(!current)return;const p=localPoint(event.clientX,event.clientY),now=performance.now();
    const singleId=group.children.length===1?group.children[0]:null,singleBlock=singleId?workspace.blocks.get(singleId):null,morphToFloat=Boolean(singleBlock&&singleId&&group.posture!=='floating'&&!workspace.groups.has(singleId));
    const pref=singleBlock?preferredFloatingSize(singleBlock,current,size):{width:current.width,height:current.height};
    dragRef.current={groupId,pointerId:event.pointerId,startX:p.x,startY:p.y,startT:now,grabX:p.x-current.x,grabY:p.y-current.y,started:false,lastX:p.x,lastY:p.y,lastT:now,rawCandidate:null,candidate:null,commitCandidate:null,gate:{key:null,since:now,candidate:null},originRect:current,currentRect:current,floatWidth:pref.width,floatHeight:pref.height,morphToFloat};
    event.currentTarget.setPointerCapture?.(event.pointerId);workspace.focusGroup(groupId);setContextMenu(null);event.preventDefault();
  };
  const moveGroupDrag=(event:PointerEvent<HTMLElement>)=>{
    const d=dragRef.current;if(!d||d.pointerId!==event.pointerId)return;const group=workspace.groups.get(d.groupId);if(!group)return;const p=localPoint(event.clientX,event.clientY);
    const distance=Math.hypot(p.x-d.startX,p.y-d.startY);if(!d.started&&distance<6)return;d.started=true;
    const now=performance.now(),dt=Math.max(6,now-d.lastT),vx=(p.x-d.lastX)/dt*1000,vy=(p.y-d.lastY)/dt*1000,velocity=Math.hypot(vx,vy);d.lastX=p.x;d.lastY=p.y;d.lastT=now;
    const distanceProgress=clamp((distance-6)/34,0,1),holdProgress=clamp((now-d.startT-80)/140,0,1),morph=d.morphToFloat?Math.max(distanceProgress,holdProgress*.7):0,ease=1-Math.pow(1-morph,3);
    const width=d.originRect.width+(d.floatWidth-d.originRect.width)*ease,height=d.originRect.height+(d.floatHeight-d.originRect.height)*ease;
    const grabRatioX=d.originRect.width?clamp(d.grabX/d.originRect.width,0,1):.18,grabRatioY=d.originRect.height?clamp(d.grabY/d.originRect.height,0,1):.08;
    let x=clamp(p.x-width*grabRatioX,0,Math.max(0,size.width-width)),y=clamp(p.y-height*grabRatioY,0,Math.max(0,size.height-height));
    const snapThreshold=velocity>1100?0:velocity>650?snap*.35:snap;
    const snapped=snapRect(rect(x,y,width,height),{workspaceRect,peers:peerRects(group.id),threshold:snapThreshold});x=snapped.x;y=snapped.y;d.currentRect=rect(x,y,width,height);
    const candidates=event.altKey?[]:resolveDockCandidates(p,{workspaceRect:{left:workspaceRect.x,top:workspaceRect.y,right:workspaceRect.x+workspaceRect.width,bottom:workspaceRect.y+workspaceRect.height,width:workspaceRect.width,height:workspaceRect.height},targets:browserTargets(group.id),radius:dockRadius,velocity});
    d.rawCandidate=chooseDockCandidate(candidates,d.rawCandidate,{hysteresis});
    d.candidate=d.rawCandidate&&d.rawCandidate.strength>=previewStrength?d.rawCandidate:null;
    const relation=d.rawCandidate?.relation,relationshipHold=relation==='home'?Math.min(intentHoldMs,42):relation==='dock'?Math.min(intentHoldMs,58):intentHoldMs,relationshipInstant=relation==='home'?.80:relation==='dock'?.86:.92;
    d.gate=stabilizeDockCandidate(d.rawCandidate,d.gate,{now,holdMs:relationshipHold,minStrength:commitStrength,instantStrength:relationshipInstant});d.commitCandidate=d.gate.candidate;
    const preview=previewFor(d.candidate),magnet=magneticOffset(d.currentRect,preview,d.candidate?.strength??0,motionConfig.magnetism),pose=resolveKineticPose({velocityX:vx,velocityY:vy,fieldStrength:d.candidate?.strength??0,magnet,motion:motionConfig});
    scheduleInteraction({candidate:d.candidate,commitCandidate:d.commitCandidate,armed:Boolean(d.commitCandidate),guides:showSmartGuides?snapped.guides:[],intent:dockIntentLabel(d.candidate),kind:'group',ghost:null,dragRect:d.currentRect,blockId:null,sourceGroupId:null,dragGroupId:group.id,pointer:p,pose,velocity});
    onEvent?.({type:'drag',kind:'group',groupId:group.id,candidate:d.candidate,velocity,pose});
  };
  const endGroupDrag=(event:PointerEvent<HTMLElement>)=>{
    const d=dragRef.current;if(!d||d.pointerId!==event.pointerId)return;dragRef.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);const directAttach=d.candidate?.kind==='merge'&&(d.candidate.relation==='home'||d.candidate.relation==='dock')&&d.candidate.strength>=.56?d.candidate:null,c=d.commitCandidate&&d.commitCandidate.strength>=commitStrength?d.commitCandidate:directAttach,current=d.currentRect;clearInteraction();if(!d.started)return;
    if(c&&liveDocking){
      if(c.kind==='workspace-edge')workspace.dockGroup(d.groupId,{area:c.area??'right',size:dockRatio});
      else if(c.kind==='split'&&c.targetId)workspace.splitGroup(d.groupId,c.targetId,c.area??'right',splitRatio);
      else if(c.kind==='merge'&&c.targetId){const source=workspace.groups.get(d.groupId),single=source?.children.length===1?source.children[0]:null,home=single?workspace.getBlockReturnState(single):null;if(single&&home?.sourceGroupId===c.targetId)workspace.returnBlock(single);else workspace.mergeGroups(d.groupId,c.targetId)}
    }else if(d.candidate?.kind==='workspace-edge'&&d.candidate.area)workspace.snapGroupToEdge(d.groupId,d.candidate.area as Exclude<DockArea,'center'>,{workspaceWidth:size.width,workspaceHeight:size.height,gap:Math.max(8,snap*.5),bounds:{x:current.x,y:current.y,width:current.width,height:current.height}});
    else workspace.floatGroup(d.groupId,{x:current.x,y:current.y,width:current.width,height:current.height});
    onEvent?.({type:'drop',kind:'group',groupId:d.groupId,candidate:c});
  };

  // Exact tab insertion is only active over a tab strip. Body drops use the spatial merge/split candidate.
  const tabTargetAt=(clientX:number,clientY:number)=>{const element=document.elementFromPoint(clientX,clientY) as HTMLElement|null,strip=element?.closest<HTMLElement>('[data-mb-tabs="true"],.au-tab-bar');if(!strip)return null;const surface=strip.closest<HTMLElement>('[data-mb-group-id]');if(!surface)return null;const targetId=surface.dataset.mbGroupId;if(!targetId)return null;const tabs=[...strip.querySelectorAll<HTMLElement>('[data-mb-block-tab="true"]')];let index=workspace.groups.get(targetId)?.children.length??0;for(let i=0;i<tabs.length;i++){const r=tabs[i].getBoundingClientRect();if(clientX<r.left+r.width/2){index=i;break}}return{targetId,index}};

  const openBlockContextMenu=(event:ReactMouseEvent<HTMLElement>,groupId:string,blockId:string)=>{const block=workspace.blocks.get(blockId),group=workspace.groups.get(groupId);if(!block||!group||group.lockedFullscreen)return;event.preventDefault();event.stopPropagation();const p=localPoint(event.clientX,event.clientY);setContextMenu({x:p.x,y:p.y,blockId,groupId,scope:'block'});workspace.activateBlock(blockId)};
  const openGroupContextMenu=(event:ReactMouseEvent<HTMLElement>,groupId:string)=>{const group=workspace.groups.get(groupId);if(!group||group.lockedFullscreen)return;event.preventDefault();event.stopPropagation();const p=localPoint(event.clientX,event.clientY);setContextMenu({x:p.x,y:p.y,blockId:group.activeChild??null,groupId,scope:'group'});workspace.focusGroup(groupId)};
  const blockProps=(groupId:string,blockId:string)=>({
    'data-block-id':blockId,'data-mb-block-tab':'true','aria-grabbed':blockDragRef.current?.blockId===blockId?true:undefined,
    onContextMenu:(event:ReactMouseEvent<HTMLElement>)=>openBlockContextMenu(event,groupId,blockId),
    onPointerDown:(event:PointerEvent<HTMLElement>)=>{if(event.button!==0)return;const group=workspace.groups.get(groupId),block=workspace.blocks.get(blockId);if(!group||!block||workspace.groups.has(blockId)||group.lockedFullscreen||block.capabilities.movable===false)return;const p=localPoint(event.clientX,event.clientY),sourceRect=getRectForGroup(groupId);if(!sourceRect)return;const preferred=preferredFloatingSize(block,sourceRect,size),b=rootRef.current?.getBoundingClientRect(),tr=event.currentTarget.getBoundingClientRect(),originVisual=rect(tr.left-(b?.left??0),tr.top-(b?.top??0),Math.max(42,tr.width),Math.max(24,tr.height));blockDragRef.current={blockId,sourceGroupId:groupId,sourceIndex:group.children.indexOf(blockId),pointerId:event.pointerId,startX:p.x,startY:p.y,startT:performance.now(),lastX:p.x,lastY:p.y,lastT:performance.now(),started:false,rawCandidate:null,candidate:null,commitCandidate:null,gate:{key:null,since:performance.now(),candidate:null},ghost:originVisual,originVisual,floatWidth:preferred.width,floatHeight:preferred.height};event.currentTarget.setPointerCapture?.(event.pointerId);setContextMenu(null);event.stopPropagation()},
    onPointerMove:(event:PointerEvent<HTMLElement>)=>{const d=blockDragRef.current;if(!d||d.pointerId!==event.pointerId)return;const p=localPoint(event.clientX,event.clientY),distance=Math.hypot(p.x-d.startX,p.y-d.startY);if(!d.started&&distance<7)return;d.started=true;const now=performance.now(),dt=Math.max(6,now-d.lastT),vx=(p.x-d.lastX)/dt*1000,vy=(p.y-d.lastY)/dt*1000,velocity=Math.hypot(vx,vy);d.lastX=p.x;d.lastY=p.y;d.lastT=now;const holdProgress=clamp((now-d.startT-70)/120,0,1),moveProgress=clamp((distance-7)/26,0,1),detachProgress=Math.max(moveProgress,holdProgress*.72),ease=1-Math.pow(1-detachProgress,3),w=d.originVisual.width+(d.floatWidth-d.originVisual.width)*ease,h=d.originVisual.height+(d.floatHeight-d.originVisual.height)*ease,targetX=clamp(p.x-Math.min(86,d.floatWidth*.22),0,Math.max(0,size.width-d.floatWidth)),targetY=clamp(p.y-18,0,Math.max(0,size.height-d.floatHeight)),baseX=d.originVisual.x+(targetX-d.originVisual.x)*ease,baseY=d.originVisual.y+(targetY-d.originVisual.y)*ease;let proposed=rect(baseX,baseY,w,h);const snapThreshold=velocity>1100?0:velocity>650?snap*.35:snap;const snapped=snapRect(proposed,{workspaceRect,peers:peerRects(d.sourceGroupId),threshold:snapThreshold});d.ghost=rect(snapped.x,snapped.y,proposed.width,proposed.height);
      const candidates=event.altKey?[]:resolveDockCandidates(p,{workspaceRect:{left:workspaceRect.x,top:workspaceRect.y,right:workspaceRect.x+workspaceRect.width,bottom:workspaceRect.y+workspaceRect.height,width:workspaceRect.width,height:workspaceRect.height},targets:browserTargetsForBlock(d.sourceGroupId,d.blockId),radius:dockRadius,velocity});d.rawCandidate=chooseDockCandidate(candidates,d.rawCandidate,{hysteresis});d.candidate=d.rawCandidate&&d.rawCandidate.strength>=previewStrength?d.rawCandidate:null;const relation=d.rawCandidate?.relation,relationshipHold=relation==='home'?Math.min(intentHoldMs,42):relation==='dock'?Math.min(intentHoldMs,58):intentHoldMs,relationshipInstant=relation==='home'?.80:relation==='dock'?.86:.94;d.gate=stabilizeDockCandidate(d.rawCandidate,d.gate,{now,holdMs:relationshipHold,minStrength:commitStrength,instantStrength:relationshipInstant});d.commitCandidate=d.gate.candidate;const softSnap=!d.candidate?resolveWorkspaceSnapCandidate(d.ghost,snapped.guides):null,visibleCandidate=d.candidate??softSnap,preview=previewFor(d.candidate),magnet=d.commitCandidate?magneticOffset(d.ghost,preview,d.candidate?.strength??0,motionConfig.magnetism,1.25):{x:0,y:0},pose=resolveKineticPose({velocityX:vx,velocityY:vy,fieldStrength:d.candidate?.strength??0,magnet,motion:motionConfig});scheduleInteraction({candidate:visibleCandidate,commitCandidate:d.commitCandidate,armed:Boolean(d.commitCandidate),guides:showSmartGuides?snapped.guides:[],intent:dockIntentLabel(visibleCandidate),kind:'block',ghost:d.ghost,dragRect:null,blockId:d.blockId,sourceGroupId:d.sourceGroupId,dragGroupId:null,pointer:p,pose,velocity});onEvent?.({type:'drag',kind:'block',blockId:d.blockId,sourceGroupId:d.sourceGroupId,candidate:visibleCandidate,commitCandidate:d.commitCandidate,velocity,pose})},
    onPointerUp:(event:PointerEvent<HTMLElement>)=>{const d=blockDragRef.current;if(!d||d.pointerId!==event.pointerId)return;blockDragRef.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);const wasStarted=d.started,directAttach=d.candidate?.kind==='merge'&&(d.candidate.relation==='home'||d.candidate.relation==='dock')&&d.candidate.strength>=.56?d.candidate:null,c=d.commitCandidate&&d.commitCandidate.strength>=commitStrength?d.commitCandidate:directAttach,ghost=d.ghost;clearInteraction();if(!wasStarted){workspace.activateBlock(blockId);return}
      const tabTarget=tabTargetAt(event.clientX,event.clientY);if(tabTarget){if(tabTarget.targetId===d.sourceGroupId)workspace.reorderBlock(tabTarget.targetId,blockId,tabTarget.index);else workspace.moveBlock(blockId,tabTarget.targetId,tabTarget.index);workspace.activateBlock(blockId);onEvent?.({type:'drop',kind:'block',blockId,candidate:{kind:'tab',targetId:tabTarget.targetId}});return}
      if(d.candidate?.kind==='merge'&&d.candidate.targetId===d.sourceGroupId&&!c){workspace.reorderBlock(d.sourceGroupId,blockId,d.sourceIndex);workspace.activateBlock(blockId);onEvent?.({type:'drop',kind:'block',blockId,candidate:{...d.candidate,intent:'KEEP IN GROUP'}});return}
      if(c&&liveDocking){if(c.kind==='merge'&&c.targetId){if(c.targetId===d.sourceGroupId)workspace.reorderBlock(d.sourceGroupId,blockId,d.sourceIndex);else{const home=workspace.getBlockReturnState(blockId);if(home?.sourceGroupId===c.targetId)workspace.returnBlock(blockId);else workspace.mergeBlock(blockId,c.targetId)}}else if(c.kind==='split'&&c.targetId===d.sourceGroupId){const source=workspace.groups.get(d.sourceGroupId);if(source){const current=(Array.isArray(source.meta?.splitChildren)?source.meta.splitChildren:[]).filter((id:string)=>source.children.includes(id)&&id!==blockId),anchor=source.activeChild!==blockId&&source.activeChild?source.activeChild:source.children.find(id=>id!==blockId),base=current.length?current:anchor?[anchor]:[],before=c.area==='left'||c.area==='top',at=Math.max(0,anchor?base.indexOf(anchor):-1),splitChildren=before?[...base.slice(0,at),blockId,...base.slice(at)]:[...base.slice(0,at+1),blockId,...base.slice(at+1)];workspace.setGroupMeta(source.id,{splitChildren:[...new Set(splitChildren)],splitAxis:c.area==='top'||c.area==='bottom'?'vertical':'horizontal'});workspace.activateBlock(anchor??blockId)}}else if(c.kind==='split'&&c.targetId)workspace.splitBlock(blockId,c.targetId,c.area??'right',splitRatio);else if(c.kind==='workspace-edge')workspace.dockBlock(blockId,{area:c.area??'right',size:dockRatio});workspace.activateBlock(c.kind==='split'&&c.targetId===d.sourceGroupId?(workspace.groups.get(d.sourceGroupId)?.activeChild??blockId):blockId);onEvent?.({type:'drop',kind:'block',blockId,candidate:c});return}
      if(d.candidate?.kind==='workspace-edge'&&d.candidate.area)workspace.snapBlockToEdge(blockId,d.candidate.area as Exclude<DockArea,'center'>,{workspaceWidth:size.width,workspaceHeight:size.height,gap:Math.max(8,snap*.5),bounds:{x:ghost.x,y:ghost.y,width:ghost.width,height:ghost.height}});else workspace.floatBlock(blockId,{x:ghost.x,y:ghost.y,width:ghost.width,height:ghost.height});workspace.activateBlock(blockId);onEvent?.({type:'drop',kind:'block',blockId,candidate:d.candidate?.kind==='workspace-edge'?{...d.candidate,kind:'workspace-snap'}:null})},
    onPointerCancel:(event:PointerEvent<HTMLElement>)=>{if(blockDragRef.current?.pointerId===event.pointerId){blockDragRef.current=null;clearInteraction()}}
  });

  const beginResize=(event:PointerEvent<HTMLElement>,groupId:string,edge:ResizeEdge)=>{if(event.button!==0)return;const group=workspace.groups.get(groupId),r=getRectForGroup(groupId);if(!group||group.lockedFullscreen||!r||group.capabilities.resizable===false)return;const p=localPoint(event.clientX,event.clientY);event.stopPropagation();resizeRef.current={groupId,pointerId:event.pointerId,edge,startX:p.x,startY:p.y,x:r.x,y:r.y,width:r.width,height:r.height};setResizeGuide({groupId,edge,rect:r});event.currentTarget.setPointerCapture?.(event.pointerId)};
  const moveResize=(event:PointerEvent<HTMLElement>)=>{const d=resizeRef.current;if(!d||d.pointerId!==event.pointerId)return;const group=workspace.groups.get(d.groupId);if(!group)return;const p=localPoint(event.clientX,event.clientY),dx=p.x-d.startX,dy=p.y-d.startY,west=d.edge.includes('w'),east=d.edge.includes('e'),north=d.edge.includes('n'),south=d.edge.includes('s');if(group.posture==='floating'){const right=d.x+d.width,bottom=d.y+d.height,x=west?Math.min(d.x+dx,right-220):d.x,y=north?Math.min(d.y+dy,bottom-150):d.y,width=west?right-x:east?Math.max(220,d.width+dx):d.width,height=north?bottom-y:south?Math.max(150,d.height+dy):d.height,next=rect(x,y,width,height);workspace.setFloatingBounds(group.id,{x,y,width,height},{history:false});setResizeGuide({groupId:group.id,edge:d.edge,rect:next});return}if(group.posture==='zone'){const zone=[...workspace.zones.values()].find(z=>z.groups.includes(group.id));if(!zone)return;const zr=resolveZoneRect(zone,workspaceRect),mode=zone.modeByGroup[group.id]==='auto'?resolveZoneMode(zone,{width:size.width,height:size.height,role:group.role}):zone.modeByGroup[group.id],inset={...(group.meta?.edgeInset??{})};if(west)inset.left=clamp(p.x-zr.x,0,zr.width-240);if(east)inset.right=clamp(zr.x+zr.width-p.x,0,zr.width-240);if(mode==='bottom-dock'){if(south)inset.bottom=clamp(zr.y+zr.height-p.y,0,zr.height-180);if(north)workspace.setGroupMeta(group.id,{zoneSize:clamp((zr.y+zr.height-(inset.bottom??0)-p.y)/Math.max(1,zr.height-(inset.top??0)-(inset.bottom??0)),.12,.72)})}else if(mode==='top-dock'){if(north)inset.top=clamp(p.y-zr.y,0,zr.height-180);if(south)workspace.setGroupMeta(group.id,{zoneSize:clamp((p.y-(zr.y+(inset.top??0)))/Math.max(1,zr.height-(inset.top??0)-(inset.bottom??0)),.12,.72)})}else if(mode==='left-dock'){if(north)inset.top=clamp(p.y-zr.y,0,zr.height-180);if(south)inset.bottom=clamp(zr.y+zr.height-p.y,0,zr.height-180);if(east)workspace.setGroupMeta(group.id,{zoneSize:clamp((p.x-(zr.x+(inset.left??0)))/Math.max(1,zr.width-(inset.left??0)-(inset.right??0)),.12,.72)})}else if(mode==='right-dock'){if(north)inset.top=clamp(p.y-zr.y,0,zr.height-180);if(south)inset.bottom=clamp(zr.y+zr.height-p.y,0,zr.height-180);if(west)workspace.setGroupMeta(group.id,{zoneSize:clamp((zr.x+zr.width-(inset.right??0)-p.x)/Math.max(1,zr.width-(inset.left??0)-(inset.right??0)),.12,.72)})}workspace.setGroupMeta(group.id,{edgeInset:inset});const next=getRectForGroup(group.id);if(next)setResizeGuide({groupId:group.id,edge:d.edge,rect:next});return}const node=workspace.layout.find(n=>n.groupId===group.id);if(!node)return;if(node.area==='left'&&(east||west))workspace.resizeDockedGroup(group.id,clamp(p.x/size.width,.08,.72),{history:false});else if(node.area==='right'&&(east||west))workspace.resizeDockedGroup(group.id,clamp((size.width-p.x)/size.width,.08,.72),{history:false});else if(node.area==='top'&&(north||south))workspace.resizeDockedGroup(group.id,clamp(p.y/size.height,.08,.72),{history:false});else if(node.area==='bottom'&&(north||south))workspace.resizeDockedGroup(group.id,clamp((size.height-p.y)/size.height,.08,.72),{history:false});const next=getRectForGroup(group.id);if(next)setResizeGuide({groupId:group.id,edge:d.edge,rect:next})};
  const endResize=(event:PointerEvent<HTMLElement>)=>{if(resizeRef.current?.pointerId!==event.pointerId)return;resizeRef.current=null;setResizeGuide(null);event.currentTarget.releasePointerCapture?.(event.pointerId)};

  const preview=previewFor(interaction.candidate),targetRect=interaction.candidate?.targetId?targetRects.get(interaction.candidate.targetId)??null:null;
  const displayIntent=interaction.candidate?.kind==='workspace-edge'&&!interaction.armed?`SNAP ${String(interaction.candidate.area).toUpperCase()} · HOLD TO DOCK`:interaction.intent;
  const groups=[...workspace.groups.values()].filter(group=>(group.meta?.visible??true)!==false&&group.posture!=='popout');
  const rootStyle={'--mb-settle-ms':`${resolveSettleDuration(motionConfig)}ms`,'--mb-ease-spring':resolveSettleCurve(motionConfig),'--mb-stiffness':motionConfig.stiffness,'--mb-damping':motionConfig.damping,'--mb-mass':motionConfig.mass,'--mb-magnetism':motionConfig.magnetism,'--mb-inertia':motionConfig.inertia,'--mb-compression':motionConfig.compression,'--mb-field-strength':interaction.candidate?.strength??0,'--mb-kinetic-energy':interaction.pose.energy} as CSSProperties;
  const targetName=interaction.candidate?.targetId?(workspace.groups.get(interaction.candidate.targetId)?.title??workspace.blocks.get(interaction.candidate.targetId)?.title??'MetaBlock'):null;

  const contextBlock=contextMenu?.blockId?workspace.blocks.get(contextMenu.blockId)??null:null,contextGroup=contextMenu?workspace.groups.get(contextMenu.groupId)??null:null,contextReturn=contextMenu?.blockId?workspace.getBlockReturnState(contextMenu.blockId):null,contextRelationship=contextMenu?.blockId?workspace.getBlockRelationshipContext(contextMenu.blockId):null;
  const contextTargets=contextMenu?[...workspace.groups.values()].filter(g=>g.id!==contextMenu.groupId&&!g.lockedFullscreen&&(g.meta?.visible??true)!==false&&g.capabilities.acceptsDrop!==false).sort((a,b)=>{const homeId=contextMenu.blockId?workspace.getBlockReturnState(contextMenu.blockId)?.sourceGroupId:null;const score=(g:MetaBlockGroup)=>g.id===homeId?0:g.role==='dock'?1:g.children.length?2:3;return score(a)-score(b)}):[];
  const menuAction=(fn:()=>void)=>{setContextMenu(null);fn()};
  const blockContextModel:MetaBlockContextMenuModel|null=contextMenu?.scope==='block'&&contextBlock&&contextGroup?(()=>{
    const parent=contextRelationship?.parent??contextGroup,home=contextReturn?workspace.groups.get(contextReturn.sourceGroupId)??null:null;
    const parentName=parent.title||parent.id,homeName=home?.title??contextReturn?.sourceGroup.title??'Parent';
    const floatHere=()=>{const r=getRectForGroup(contextGroup.id);if(!r)return;const pref=preferredFloatingSize(contextBlock,r,size);workspace.floatBlock(contextBlock.id,{x:clamp(contextMenu.x-44,8,Math.max(8,size.width-pref.width-8)),y:clamp(contextMenu.y-20,8,Math.max(8,size.height-pref.height-8)),width:pref.width,height:pref.height})};
    const snapItems=(['left','right','top','bottom'] as const).map(edge=>({id:`snap-${edge}`,label:`Snap ${edge[0].toUpperCase()+edge.slice(1)}`,detail:'Keep floating',onSelect:()=>{const r=getRectForGroup(contextGroup.id);workspace.snapBlockToEdge(contextBlock.id,edge,{workspaceWidth:size.width,workspaceHeight:size.height,gap:8,bounds:r?{x:r.x,y:r.y,width:r.width,height:r.height}:undefined})}}));
    const dockItems=(['left','right','top','bottom'] as const).map(area=>({id:`dock-${area}`,label:`Dock ${area[0].toUpperCase()+area.slice(1)}`,detail:'Workspace edge',onSelect:()=>workspace.dockBlock(contextBlock.id,{area,size:dockRatio})}));
    const attachItems=contextTargets.slice(0,8).map(target=>{const isHome=target.id===contextReturn?.sourceGroupId;return{id:`attach-${target.id}`,label:isHome?`Rejoin ${target.title}`:target.role==='dock'?`Attach to ${target.title}`:`Group with ${target.title}`,detail:isHome?`Restore tab ${Math.max(1,(contextReturn?.sourceIndex??0)+1)}`:target.role==='dock'?`${target.children.length} MetaBlock${target.children.length===1?'':'s'}`:(workspace.blocks.get(target.activeChild??'')?.title??target.role),primary:isHome,onSelect:()=>isHome?workspace.returnBlock(contextBlock.id):workspace.mergeBlock(contextBlock.id,target.id)}});
    const relationshipItems:MetaBlockContextMenuItem[]=[];
    if(contextReturn)relationshipItems.push({id:'return-home',label:`Attach Back to ${homeName}`,detail:`Tab ${Math.max(1,contextReturn.sourceIndex+1)}`,shortcut:'↩',primary:true,onSelect:()=>workspace.returnBlock(contextBlock.id)});
    if(contextBlock.capabilities.floatable!==false&&(!contextRelationship?.isDetached||contextGroup.posture!=='floating'))relationshipItems.push({id:'detach-float',label:contextRelationship?.isDockChild?`Detach from ${parentName}`:'Detach & Float',detail:'Open at preferred panel size',shortcut:'F',onSelect:floatHere});
    else if(contextGroup.posture==='floating'&&contextBlock.capabilities.floatable!==false)relationshipItems.push({id:'reset-float-size',label:'Reset Floating Size',detail:'Preferred panel geometry',onSelect:floatHere});
    const windowItems:MetaBlockContextMenuItem[]=[];
    if(contextBlock.capabilities.maximizable!==false)windowItems.push({id:'maximize',label:contextGroup.posture==='maximized'?'Restore MetaBlock':'Maximize over Viewport',detail:contextGroup.posture==='maximized'?'Previous posture':'Viewport stays locked',onSelect:()=>contextGroup.posture==='maximized'?workspace.restoreBlock(contextBlock.id):workspace.maximizeBlock(contextBlock.id)});
    if(contextBlock.capabilities.popoutable!==false)windowItems.push({id:'popout',label:'Pop Out Window',detail:'External browser window',onSelect:()=>workspace.popoutBlock(contextBlock.id)});
    if(contextBlock.capabilities.pinable!==false){windowItems.push({id:'pin-left',label:'Pin Left',detail:'Persistent edge',onSelect:()=>workspace.pinBlock(contextBlock.id,{edge:'left'})},{id:'pin-right',label:'Pin Right',detail:'Persistent edge',onSelect:()=>workspace.pinBlock(contextBlock.id,{edge:'right'})},{id:'autohide-left',label:'Auto-hide Left',detail:'Reveal on approach',onSelect:()=>workspace.pinBlock(contextBlock.id,{edge:'left',autoHide:true})},{id:'autohide-right',label:'Auto-hide Right',detail:'Reveal on approach',onSelect:()=>workspace.pinBlock(contextBlock.id,{edge:'right',autoHide:true})})}
    const sections:MetaBlockContextMenuSection[]=[
      {id:'relationship',label:contextRelationship?.isDockChild?'Parent / Relationship':'Relationship',items:relationshipItems},
      {id:'snap',label:'Align · stays floating',layout:'grid' as const,items:contextBlock.capabilities.floatable!==false?snapItems:[]},
      {id:'dock',label:'Dock · structural',layout:'grid' as const,items:contextBlock.capabilities.dockable!==false?dockItems:[]},
      {id:'attach',label:'Attach / Group',items:contextBlock.capabilities.tabbable!==false?attachItems:[]},
      {id:'window',label:'Window / Posture',items:windowItems},
      {id:'danger',items:contextBlock.capabilities.closable!==false?[{id:'close',label:'Close MetaBlock',detail:'Remove from workspace',danger:true,onSelect:()=>workspace.removeBlock(contextBlock.id)}]:[]}
    ].filter(section=>section.items.length);
    return{title:contextBlock.title,subtitle:`${String(contextBlock.role).toUpperCase()} · ${String(contextGroup.posture).toUpperCase()}`,meta:`PARENT · ${parentName}`,sections};
  })():null;
  const groupContextModel:MetaBlockContextMenuModel|null=contextMenu?.scope==='group'&&contextGroup?(()=>{
    const group=contextGroup,base=getRectForGroup(group.id),homeZoneId=String(group.meta?.homeZoneId??''),homeZone=homeZoneId?workspace.zones.get(homeZoneId):null;
    const floatGroup=()=>{if(!base)return;const preferred=group.meta?.preferredFloatingSize??{};const width=clamp(Number(preferred.width??base.width),320,Math.max(340,size.width-24)),height=clamp(Number(preferred.height??base.height),220,Math.max(240,size.height-24));workspace.floatGroup(group.id,{x:clamp(contextMenu.x-80,12,Math.max(12,size.width-width-12)),y:clamp(contextMenu.y-24,12,Math.max(12,size.height-height-12)),width,height})};
    const snapItems=(['left','right','top','bottom'] as const).map(edge=>({id:`group-snap-${edge}`,label:`Snap ${edge[0].toUpperCase()+edge.slice(1)}`,detail:'Keep parent floating',onSelect:()=>workspace.snapGroupToEdge(group.id,edge,{workspaceWidth:size.width,workspaceHeight:size.height,gap:12,bounds:base?{x:base.x,y:base.y,width:base.width,height:base.height}:undefined})}));
    const dockItems=(['left','right','top','bottom'] as const).map(area=>({id:`group-dock-${area}`,label:`Dock ${area[0].toUpperCase()+area.slice(1)}`,detail:'Parent + all children',onSelect:()=>workspace.dockGroup(group.id,{area,size:dockRatio})}));
    const postureItems:MetaBlockContextMenuItem[]=[];
    if(homeZone)postureItems.push({id:'group-home',label:`Return to ${String(group.meta?.homeZoneMode??'bottom-dock').replace('-', ' ')}`,detail:`${group.children.length} child MetaBlocks`,primary:true,onSelect:()=>workspace.placeGroupInZone(group.id,homeZone.id,{mode:group.meta?.homeZoneMode??'bottom-dock'})});
    if(group.capabilities.floatable!==false&&group.posture!=='floating')postureItems.push({id:'group-float',label:'Detach Dock & Float',detail:'Move the parent with every child',onSelect:floatGroup});
    else if(group.posture==='floating')postureItems.push({id:'group-reset-float',label:'Reset Floating Size',detail:'Preferred parent geometry',onSelect:floatGroup});
    if(group.capabilities.maximizable!==false)postureItems.push({id:'group-maximize',label:group.posture==='maximized'?'Restore Parent':'Maximize Parent',detail:'Fill workspace above locked viewport',onSelect:()=>group.posture==='maximized'?workspace.restoreGroup(group.id):workspace.maximizeGroup(group.id)});
    const edgeItems:MetaBlockContextMenuItem[]=group.capabilities.pinable===false?[]:[{id:'group-pin-left',label:'Pin Left',detail:'Persistent parent edge',onSelect:()=>workspace.pinGroup(group.id,{edge:'left'})},{id:'group-pin-right',label:'Pin Right',detail:'Persistent parent edge',onSelect:()=>workspace.pinGroup(group.id,{edge:'right'})},{id:'group-autohide-left',label:'Auto-hide Left',detail:'Reveal on approach',onSelect:()=>workspace.pinGroup(group.id,{edge:'left',autoHide:true})},{id:'group-autohide-right',label:'Auto-hide Right',detail:'Reveal on approach',onSelect:()=>workspace.pinGroup(group.id,{edge:'right',autoHide:true})}];
    const sections:MetaBlockContextMenuSection[]=[{id:'parent-posture',label:'Parent MetaBlock',items:postureItems},{id:'parent-snap',label:'Align · stays floating',layout:'grid' as const,items:group.capabilities.floatable===false?[]:snapItems},{id:'parent-dock',label:'Dock · structural',layout:'grid' as const,items:group.capabilities.dockable===false?[]:dockItems},{id:'parent-edge',label:'Pin / Auto-hide',items:edgeItems}].filter(section=>section.items.length);
    return{title:group.title,subtitle:`${String(group.role).toUpperCase()} · ${String(group.posture).toUpperCase()}`,meta:`PARENT · ${group.children.length} CHILD METABLOCK${group.children.length===1?'':'S'}`,sections};
  })():null;
  const contextModel=contextMenu?.scope==='group'?groupContextModel:blockContextModel;

  return <div ref={rootRef} className={`mb-workspace-root ${className}`.trim()} data-workspace-id={workspace.id} data-dragging={interaction.kind??undefined} data-motion-profile={motionConfig.profile} style={rootStyle}>
    {groups.map(group=>{const base=getRectForGroup(group.id);if(!base)return null;const display=interaction.dragGroupId===group.id&&interaction.dragRect?interaction.dragRect:base,blocks=group.children.map(id=>workspace.blocks.get(id)).filter(Boolean) as MetaBlockInstance[],active=workspace.blocks.get(group.activeChild??'')??blocks[0]??null,splitBlocks=(Array.isArray(group.meta?.splitChildren)?group.meta.splitChildren:[]).map((id:string)=>workspace.blocks.get(id)).filter((block):block is MetaBlockInstance=>Boolean(block)&&group.children.includes(block!.id)),visibleBlocks=splitBlocks.length>1?splitBlocks:active?[active]:[],z=group.lockedFullscreen?0:interaction.dragGroupId===group.id?980:group.posture==='floating'?(workspace.floating.get(group.id)?.z??100):group.posture==='maximized'?900:group.posture==='zone'?220:20,isDragging=interaction.dragGroupId===group.id;const pose=isDragging?interaction.pose:zeroPose;const style={left:display.x,top:display.y,width:display.width,height:display.height,zIndex:z,'--mb-pose-x':`${pose.translateX}px`,'--mb-pose-y':`${pose.translateY}px`,'--mb-pose-rotate':`${pose.rotate}deg`,'--mb-pose-scale':pose.scale,'--mb-pose-lift':`${pose.lift}px`,'--mb-energy':pose.energy,'--mb-field':pose.field} as CSSProperties;const dragHandleProps=group.lockedFullscreen?{}:{onPointerDown:(e:PointerEvent<HTMLElement>)=>beginGroupDrag(e,group.id),onPointerMove:moveGroupDrag,onPointerUp:endGroupDrag,onPointerCancel:endGroupDrag,onContextMenu:(e:ReactMouseEvent<HTMLElement>)=>openGroupContextMenu(e,group.id)};const blockActions:BlockActions={float:(id)=>{const rr=getRectForGroup(group.id);if(!rr)return;const block=workspace.blocks.get(id);if(!block)return;const pref=preferredFloatingSize(block,rr,size);workspace.floatBlock(id,{x:clamp(rr.x+28,8,Math.max(8,size.width-pref.width-8)),y:clamp(rr.y+28,8,Math.max(8,size.height-pref.height-8)),width:pref.width,height:pref.height})},returnHome:id=>{workspace.returnBlock(id)},snap:(id,edge)=>{const rr=getRectForGroup(group.id)??undefined;workspace.snapBlockToEdge(id,edge,{workspaceWidth:size.width,workspaceHeight:size.height,gap:8,bounds:rr?{x:rr.x,y:rr.y,width:rr.width,height:rr.height}:undefined})},dock:(id,area,target)=>workspace.dockBlock(id,{area,targetGroupId:target??null,size:dockRatio}),split:(id,target,area)=>workspace.splitBlock(id,target,area,splitRatio),merge:(id,target)=>workspace.mergeBlock(id,target),pin:(id,edge,autoHide=false)=>workspace.pinBlock(id,{edge,size:.24,autoHide}),popout:id=>workspace.popoutBlock(id),maximize:id=>workspace.maximizeBlock(id),restore:id=>workspace.restoreBlock(id),close:id=>workspace.removeBlock(id)};const context:GroupChromeContext={group,blocks,activeBlock:active,activateBlock:id=>workspace.activateBlock(id),blockProps:id=>blockProps(group.id,id),dragHandleProps,blockActions,maximize:()=>workspace.maximizeGroup(group.id),restore:()=>workspace.restoreGroup(group.id),float:()=>workspace.floatGroup(group.id,{x:base.x,y:base.y,width:base.width,height:base.height}),close:()=>workspace.setGroupVisibility(group.id,false),panels:blocks,activePanel:active,activatePanel:id=>workspace.activateBlock(id),tabProps:id=>blockProps(group.id,id),panelActions:blockActions};const customChrome=renderGroupChrome?.(context),hasCustomChrome=customChrome!=null;
      return <section key={group.id} className={`mb-group ${group.posture==='maximized'?'mb-maximized':''} ${group.posture==='auto-hide'?'mb-auto-hide':''}`} data-mb-group-id={group.id} data-metablock-id={group.id} data-role={group.role} data-variant={group.meta?.variant??undefined} data-posture={group.posture} data-fullscreen-locked={group.lockedFullscreen?'true':'false'} data-focused={workspace.focusedGroup===group.id?'true':'false'} data-grabbed={isDragging?'true':'false'} data-empty={blocks.length?'false':'true'} data-field-active={isDragging&&Boolean(interaction.candidate)?'true':'false'} style={style} onPointerDown={()=>workspace.focusGroup(group.id)}>
        {!group.lockedFullscreen?<header className="mb-group-chrome" {...(hasCustomChrome?{}:dragHandleProps)}>{hasCustomChrome?customChrome:<div className="mb-native-tabs" data-mb-tabs="true" {...dragHandleProps}>{blocks.map(block=><button key={block.id} type="button" className={`mb-native-tab ${block.id===active?.id?'active':''}`} {...blockProps(group.id,block.id)}>{block.title}</button>)}</div>}</header>:null}
        <div className="mb-group-body">{splitBlocks.length>1?<div className="mb-panel-split" data-axis={group.meta?.splitAxis??'horizontal'}>{splitBlocks.map(block=><div key={block.id} className="mb-panel-host" data-block-id={block.id} data-block-role={block.role} data-detaching={interaction.kind==='block'&&interaction.blockId===block.id&&interaction.sourceGroupId===group.id?'true':'false'} onContextMenu={e=>openBlockContextMenu(e,group.id,block.id)}><MetaBlockBody block={block} group={group} toolbar={renderBlockToolbar?.(block,group)}>{renderContent(block,group)}</MetaBlockBody></div>)}</div>:active?<div className="mb-panel-host" data-block-id={active.id} data-block-role={active.role} data-detaching={interaction.kind==='block'&&interaction.blockId===active.id&&interaction.sourceGroupId===group.id?'true':'false'} onContextMenu={e=>openBlockContextMenu(e,group.id,active.id)}><MetaBlockBody block={active} group={group} toolbar={renderBlockToolbar?.(active,group)}>{renderContent(active,group)}</MetaBlockBody></div>:group.role==='dock'||group.meta?.persistentContainer?<div className="mb-empty-container"><b>EMPTY DOCK</b><span>DRAG A METABLOCK HERE TO ATTACH</span></div>:null}</div>
        {!group.lockedFullscreen&&renderGroupFooter?<footer className="mb-group-footer">{renderGroupFooter(group)}</footer>:null}
        {!group.lockedFullscreen&&group.capabilities.resizable!==false?(['n','s','e','w','ne','nw','se','sw'] as ResizeEdge[]).map(edge=><button key={edge} type="button" className="mb-renderer-resize" data-resize-edge={edge} aria-label={`Resize ${active?.title??group.id} from ${edge}`} onPointerDown={e=>beginResize(e,group.id,edge)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}/>):null}
      </section>})}
    {resizeGuide?<div className="mb-resize-visual-guide" data-edge={resizeGuide.edge} style={{left:resizeGuide.rect.x,top:resizeGuide.rect.y,width:resizeGuide.rect.width,height:resizeGuide.rect.height}}><span>{Math.round(resizeGuide.rect.width)} × {Math.round(resizeGuide.rect.height)}</span></div>:null}
    {interaction.pointer&&interaction.candidate&&interaction.candidate.strength>.16?<div className="mb-live-field" data-active="true" style={{left:interaction.pointer.x,top:interaction.pointer.y,width:dockRadius*1.35,height:dockRadius*1.35,opacity:.08+(interaction.candidate.strength??0)*.2}}/>:null}
    {preview?<div className="mb-dock-preview" data-kind={interaction.kind??undefined} data-area={interaction.candidate?.area??'center'} data-armed={interaction.armed?'true':'false'} style={{left:preview.x,top:preview.y,width:preview.width,height:preview.height,'--mb-preview-strength':interaction.candidate?.strength??0} as CSSProperties}><span>{interaction.armed?'RELEASE · ':''}{displayIntent}{targetName?` · ${targetName}`:''}</span></div>:null}
    {interaction.ghost?<div className="mb-panel-drag-ghost" data-field-active={interaction.candidate&&interaction.candidate.kind!=='workspace-snap'?'true':'false'} data-armed={interaction.armed?'true':'false'} style={{left:interaction.ghost.x,top:interaction.ghost.y,width:interaction.ghost.width,height:interaction.ghost.height,'--mb-ghost-x':`${interaction.pose.translateX}px`,'--mb-ghost-y':`${interaction.pose.translateY}px`,'--mb-ghost-rotate':`${interaction.pose.rotate}deg`,'--mb-ghost-scale':interaction.pose.scale} as CSSProperties}><span>{workspace.blocks.get(interaction.blockId??'')?.title??'MetaBlock'}</span><small>{interaction.candidate?interaction.intent:'DETACH · FLOAT'}</small></div>:null}
    {showSmartGuides?interaction.guides.map((guide,i)=>guide.axis==='x'?<i key={i} className="mb-snap-guide mb-snap-guide-x" style={{left:guide.value}}/>:<i key={i} className="mb-snap-guide mb-snap-guide-y" style={{top:guide.value}}/>):null}
    {showDockCompass&&targetRect&&interaction.candidate&&interaction.candidate.strength>.28?<div className="mb-dock-compass" style={{left:targetRect.x,top:targetRect.y,width:targetRect.width,height:targetRect.height}} data-area={interaction.candidate.area??'center'}><i className="north"/><i className="east"/><i className="south"/><i className="west"/><i className="center"/></div>:null}
    {showDockCompass&&interaction.candidate?.kind==='workspace-edge'&&interaction.candidate.strength>.24?<div className={`mb-workspace-edge-guide edge-${interaction.candidate.area??'right'}`}/>:null}
    {interaction.pointer&&interaction.candidate?<div className="mb-dock-intent" data-active="true" data-armed={interaction.armed?'true':'false'} style={{left:clamp(interaction.pointer.x+18,12,Math.max(12,size.width-190)),top:clamp(interaction.pointer.y+18,12,Math.max(12,size.height-38))}}><b>{interaction.armed?'RELEASE':'PREVIEW'}</b>{displayIntent}{targetName?<small>{targetName}</small>:null}</div>:null}

    {contextMenu&&contextModel?<div className="mb-context-menu-host" style={{left:clamp(contextMenu.x,8,Math.max(8,size.width-296)),top:clamp(contextMenu.y,8,Math.max(8,size.height-520))}} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>e.preventDefault()}>
      {renderContextMenu?renderContextMenu({x:contextMenu.x,y:contextMenu.y,model:contextModel,close:()=>setContextMenu(null)}):<div className="mb-context-menu" role="menu"><div className="mb-context-head"><b>{contextModel.title}</b><span>{contextModel.subtitle}</span></div>{contextModel.sections.map(section=><div key={section.id}>{section.label?<div className="mb-context-label">{section.label}</div>:null}{section.items.map(item=><button key={item.id} role="menuitem" className={`${item.primary?'primary ':''}${item.danger?'danger':''}`.trim()} disabled={item.disabled} onClick={()=>menuAction(item.onSelect)}><span>{item.label}{item.detail?<small>{item.detail}</small>:null}</span>{item.shortcut?<kbd>{item.shortcut}</kbd>:null}</button>)}</div>)}</div>}
    </div>:null}
  </div>
}
