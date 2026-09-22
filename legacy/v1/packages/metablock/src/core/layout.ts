import type { MetaBlockWorkspace } from './workspace.js';
import type { LayoutNode, Rect } from './types.js';
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const make=(x:number,y:number,width:number,height:number):Rect=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});

function splitRect(target:Rect,node:LayoutNode,gap:number){
  const ratio=clamp(node.size,.12,.72);let placed:Rect|null=null,remain:Rect=target;
  if(node.area==='left'){const w=Math.max(0,target.width*ratio-gap/2);placed=make(target.x,target.y,w,target.height);remain=make(target.x+w+gap,target.y,Math.max(0,target.width-w-gap),target.height)}
  else if(node.area==='right'){const w=Math.max(0,target.width*ratio-gap/2);placed=make(target.x+target.width-w,target.y,w,target.height);remain=make(target.x,target.y,Math.max(0,target.width-w-gap),target.height)}
  else if(node.area==='top'){const h=Math.max(0,target.height*ratio-gap/2);placed=make(target.x,target.y,target.width,h);remain=make(target.x,target.y+h+gap,target.width,Math.max(0,target.height-h-gap))}
  else if(node.area==='bottom'){const h=Math.max(0,target.height*ratio-gap/2);placed=make(target.x,target.y+target.height-h,target.width,h);remain=make(target.x,target.y,target.width,Math.max(0,target.height-h-gap))}
  return{placed,remain};
}

/**
 * Resolve a stable MetaBlock spatial graph.
 * - fullscreen-locked MetaBlocks are an immutable base layer;
 * - root docks progressively consume the independent UI workspace above that layer;
 * - targeted splits are resolved topologically, so re-group/detach does not depend on array ordering;
 * - dangling targets gracefully become root surfaces instead of exploding to fullscreen by accident.
 */
export function resolveWorkspaceRects(workspace:MetaBlockWorkspace,{width,height,padding=0,gap=0}:{width:number;height:number;padding?:number;gap?:number}){
  const result=new Map<string,Rect>();
  const full=make(padding,padding,Math.max(0,width-padding*2),Math.max(0,height-padding*2));
  const visible=[...workspace.groups.values()].filter(g=>(g.meta?.visible??true)!==false);
  const locked=visible.filter(g=>g.lockedFullscreen||g.posture==='fullscreen-locked');
  for(const group of locked)result.set(group.id,full);

  const docked=visible.filter(g=>g.posture==='docked'&&!g.lockedFullscreen);
  const dockedIds=new Set(docked.map(g=>g.id));
  const nodes=workspace.layout.filter(n=>{
    if(!dockedIds.has(n.groupId))return false;
    const group=workspace.groups.get(n.groupId);
    // A detached panel may never become the implicit root-center surface. Fullscreen is an explicit
    // maximize posture; ordinary panel docking is edge- or target-relative.
    if(n.area==='center'&&!n.targetGroupId&&group&&(group.role==='panel'||group.meta?.extractedBlock===true)&&group.meta?.allowRootCenter!==true&&group.meta?.rootFill!==true)return false;
    return true
  });
  let available=full;

  // Root nodes are ordered deterministically. Center is assigned after all edge docks.
  const roots=nodes.filter(n=>!n.targetGroupId||!dockedIds.has(n.targetGroupId)).sort((a,b)=>a.order-b.order);
  const rootEdges=roots.filter(n=>n.area!=='center');
  for(const node of rootEdges){
    const ratio=clamp(node.size,.05,.72),horizontal=node.area==='left'||node.area==='right';
    if(horizontal){
      const amount=Math.max(0,available.width*ratio-gap/2);
      if(node.area==='left'){result.set(node.groupId,make(available.x,available.y,amount,available.height));available=make(available.x+amount+gap,available.y,Math.max(0,available.width-amount-gap),available.height)}
      else{result.set(node.groupId,make(available.x+available.width-amount,available.y,amount,available.height));available=make(available.x,available.y,Math.max(0,available.width-amount-gap),available.height)}
    }else{
      const amount=Math.max(0,available.height*ratio-gap/2);
      if(node.area==='top'){result.set(node.groupId,make(available.x,available.y,available.width,amount));available=make(available.x,available.y+amount+gap,available.width,Math.max(0,available.height-amount-gap))}
      else{result.set(node.groupId,make(available.x,available.y+available.height-amount,available.width,amount));available=make(available.x,available.y,available.width,Math.max(0,available.height-amount-gap))}
    }
  }
  const centerRoot=roots.find(n=>n.area==='center'&&!result.has(n.groupId));
  if(centerRoot)result.set(centerRoot.groupId,available);

  // If there is no explicit center root, give the remaining region to the first unresolved root surface.
  const rootFallback=docked.find(g=>!result.has(g.id)&&!nodes.some(n=>n.groupId===g.id&&n.targetGroupId)&&!(g.role==='panel'||g.meta?.extractedBlock===true));
  if(rootFallback)result.set(rootFallback.id,available);

  // Resolve targeted splits only when their target has a rectangle. Repeated passes make ordering irrelevant.
  const pending=nodes.filter(n=>n.targetGroupId&&dockedIds.has(n.targetGroupId));
  let changed=true,guard=0;
  while(pending.length&&changed&&guard++<nodes.length+4){
    changed=false;
    for(let i=pending.length-1;i>=0;i--){
      const node=pending[i],target=result.get(node.targetGroupId!);if(!target)continue;
      if(node.area==='center'){result.set(node.groupId,target);pending.splice(i,1);changed=true;continue}
      const {placed,remain}=splitRect(target,node,gap);if(!placed)continue;
      result.set(node.groupId,placed);result.set(node.targetGroupId!,remain);pending.splice(i,1);changed=true;
    }
  }

  // Broken/cyclic layout data should never turn a detached panel into an accidental fullscreen pane.
  // Give unresolved docked roots a compact deterministic tile in the available region.
  const unresolved=docked.filter(g=>!result.has(g.id));
  if(unresolved.length){
    const cols=Math.max(1,Math.ceil(Math.sqrt(unresolved.length))),rows=Math.ceil(unresolved.length/cols),cellW=Math.max(180,(available.width-gap*(cols-1))/cols),cellH=Math.max(120,(available.height-gap*(rows-1))/rows);
    unresolved.forEach((g,i)=>{const col=i%cols,row=Math.floor(i/cols);result.set(g.id,make(available.x+col*(cellW+gap),available.y+row*(cellH+gap),Math.min(cellW,available.width),Math.min(cellH,available.height)))});
  }
  return result;
}

export function resolveZoneRect(zone:any,workspaceRect:Rect){const b=zone.bounds??{x:0,y:0,width:1,height:1,unit:'relative'};if(b.unit==='px')return make(workspaceRect.x+b.x,workspaceRect.y+b.y,b.width,b.height);return make(workspaceRect.x+workspaceRect.width*b.x,workspaceRect.y+workspaceRect.height*b.y,workspaceRect.width*b.width,workspaceRect.height*b.height)}
