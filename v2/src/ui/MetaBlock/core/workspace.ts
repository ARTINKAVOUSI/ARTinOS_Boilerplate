import type {
  DockArea, EdgeSurface, FloatingBounds, LayoutNode, MetaBlockCapabilities, MetaBlockGroup, MetaBlockInstance,
  MetaBlockRelationshipContext, MetaBlockReturnState, MetaBlockSpatialPlacement, PopoutRecord, SpatialConnection, WorkspaceEvent, WorkspaceSnapshot, WorkspaceZone, ZoneMode
} from './types.js';

const uid=(prefix='mb')=>`${prefix}_${Math.random().toString(36).slice(2,9)}`;
const clone=<T>(value:T):T=>structuredClone(value);
export const defaultCapabilities:Readonly<MetaBlockCapabilities>=Object.freeze({
  closable:true,movable:true,resizable:true,floatable:true,dockable:true,splittable:true,tabbable:true,
  popoutable:true,maximizable:true,nestable:true,pinable:true,autoHideable:true,acceptsDrop:true
});
type Listener=(payload:any)=>void;

function normalizeGroup(input:Omit<Partial<MetaBlockGroup>,'capabilities'>&{id:string;capabilities?:Partial<MetaBlockCapabilities>}):MetaBlockGroup{
  const children=[...(input.children??input.panels??[])];
  const activeChild=input.activeChild??input.active??children[0]??null;
  const locked=Boolean(input.lockedFullscreen||input.posture==='fullscreen-locked');
  return {
    id:input.id,
    title:input.title??input.id,
    role:input.role??'group',
    icon:input.icon??null,
    meta:{...(input.meta??{})},
    capabilities:{...defaultCapabilities,...(input.capabilities??{}),...(locked?{movable:false,resizable:false,floatable:false,dockable:false,splittable:false,popoutable:false,maximizable:false,pinable:false,autoHideable:false}:null)} as MetaBlockCapabilities,
    parentId:input.parentId??null,
    children,
    activeChild,
    panels:children,
    active:activeChild,
    posture:locked?'fullscreen-locked':(input.posture??'docked'),
    lockedFullscreen:locked
  };
}
function setActive(group:MetaBlockGroup,id:string|null){group.activeChild=id;group.active=id}

/**
 * Headless MetaBlock workspace model.
 * MetaBlock is the only spatial/content primitive. "Panel", "dock", "viewport" and "window" are roles/postures.
 * Groups are container MetaBlocks whose children are other MetaBlocks.
 */
export class MetaBlockWorkspace {
  id:string;
  readonly version=8;
  /** Authoritative registry for every MetaBlock instance, including container/group MetaBlocks. */
  blocks=new Map<string,MetaBlockInstance>();
  /** Container MetaBlocks participating in tab/dock/layout relationships. Entries reference the same objects stored in blocks. */
  groups=new Map<string,MetaBlockGroup>();
  layout:LayoutNode[]=[];
  floating=new Map<string,FloatingBounds>();
  popouts=new Map<string,PopoutRecord>();
  edgeSurfaces=new Map<string,EdgeSurface>();
  zones=new Map<string,WorkspaceZone>();
  connections=new Map<string,SpatialConnection>();
  /** Package-owned "return home" memory for detached leaf MetaBlocks. */
  returnStates=new Map<string,MetaBlockReturnState>();
  focusedGroup:string|null=null;
  selectedGroups=new Set<string>();
  private listeners=new Map<string,Set<Listener>>();
  private undoStack:Array<{label:string;before:WorkspaceSnapshot;after:WorkspaceSnapshot}>=[];
  private redoStack:Array<{label:string;before:WorkspaceSnapshot;after:WorkspaceSnapshot}>=[];
  readonly historyLimit:number;
  revision=0;

  constructor({id=uid('workspace'),historyLimit=160}: {id?:string;historyLimit?:number}={}){this.id=id;this.historyLimit=historyLimit}
  /** Compatibility view. Panels are just non-container MetaBlocks. */
  get panels(){return new Map([...this.blocks].filter(([id])=>!this.groups.has(id)))}
  on(type:string,fn:Listener){const set=this.listeners.get(type)??new Set<Listener>();set.add(fn);this.listeners.set(type,set);return()=>{set.delete(fn)}}
  emit(type:string,payload:any){this.revision+=1;for(const fn of [...(this.listeners.get(type)??[])])fn(payload);for(const fn of [...(this.listeners.get('*')??[])])fn({type,payload} satisfies WorkspaceEvent)}
  snapshot(){return clone(this.serialize())}
  private record(label:string,before:WorkspaceSnapshot,after:WorkspaceSnapshot){this.undoStack.push({label,before,after});if(this.undoStack.length>this.historyLimit)this.undoStack.shift();this.redoStack.length=0;this.emit('history',{label})}
  transact<T>(label:string,fn:()=>T){const before=this.snapshot();const result=fn();const after=this.snapshot();if(JSON.stringify(before)!==JSON.stringify(after))this.record(label,before,after);return result}

  createMetaBlock(block:Partial<MetaBlockInstance>&{id?:string;title?:string;role?:string},{groupId=null,index=Infinity}:{groupId?:string|null;index?:number}={}){
    const id=block.id??uid('block');if(this.blocks.has(id))return id;
    const instance:MetaBlockInstance={id,title:block.title??id,role:block.role??'panel',icon:block.icon??null,meta:{...(block.meta??{})},capabilities:{...defaultCapabilities,...block.capabilities},parentId:block.parentId??groupId??null};
    this.blocks.set(id,instance);if(groupId)this.attachBlock(id,groupId,index);this.emit('block:add',{block:instance});return id
  }
  /** @deprecated use createMetaBlock */
  addPanel(block:Partial<MetaBlockInstance>&{id?:string;title?:string;role?:string},opts:{groupId?:string|null;index?:number}={}){return this.createMetaBlock(block,opts)}

  removeBlock(blockId:string){return this.transact('Remove MetaBlock',()=>{if(this.groups.has(blockId))return this.removeGroup(blockId);const block=this.blocks.get(blockId);if(!block)return false;for(const group of this.groups.values()){const i=group.children.indexOf(blockId);if(i>=0){group.children.splice(i,1);if(group.activeChild===blockId)setActive(group,group.children[0]??null)}}this.blocks.delete(blockId);this.pruneEmptyGroups();this.emit('block:remove',{block});return true})}
  /** @deprecated use removeBlock */
  removePanel(blockId:string){return this.removeBlock(blockId)}

  createGroup({id=uid('group'),panels=[],children,active=null,activeChild,role='group',posture='docked',lockedFullscreen=false,meta={},capabilities={},title,icon=null,parentId=null}:{id?:string;panels?:string[];children?:string[];active?:string|null;activeChild?:string|null;role?:string;posture?:string;lockedFullscreen?:boolean;meta?:Record<string,any>;capabilities?:Partial<MetaBlockCapabilities>;title?:string;icon?:string|null;parentId?:string|null}={}){
    if(this.groups.has(id))return id;
    const group=normalizeGroup({id,title:title??id,role,posture,lockedFullscreen,meta,capabilities,icon,parentId,children:children??panels,activeChild:activeChild??active});
    this.groups.set(id,group);this.blocks.set(id,group);
    for(const childId of group.children){const child=this.blocks.get(childId);if(child)child.parentId=id}
    if(!group.lockedFullscreen&&posture==='docked'&&!this.layout.some(n=>n.groupId===id))this.layout.push({id:uid('layout'),groupId:id,area:'center',targetGroupId:null,size:1,order:this.layout.length});
    this.emit('block:add',{block:group});this.emit('group:add',{group});return id
  }
  lockGroupFullscreen(groupId:string,locked=true){const group=this.groups.get(groupId);if(!group)return false;group.lockedFullscreen=locked;group.posture=locked?'fullscreen-locked':'docked';if(locked){this.layout=this.layout.filter(n=>n.groupId!==groupId);this.floating.delete(groupId);this.popouts.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);Object.assign(group.capabilities,{movable:false,resizable:false,floatable:false,dockable:false,splittable:false,popoutable:false,maximizable:false,pinable:false,autoHideable:false})}else if(!this.layout.some(n=>n.groupId===groupId))this.layout.push({id:uid('layout'),groupId,area:'center',targetGroupId:null,size:1,order:this.layout.length});this.emit('group:fullscreen-lock',{groupId,locked});return true}

  attachBlock(blockId:string,groupId:string,index=Infinity){const group=this.groups.get(groupId);if(!group)throw new Error(`Unknown MetaBlock group: ${groupId}`);const block=this.blocks.get(blockId);if(!block||this.groups.has(blockId))throw new Error(`Unknown or non-leaf MetaBlock: ${blockId}`);const origins:string[]=[];for(const g of this.groups.values()){const i=g.children.indexOf(blockId);if(i>=0){g.children.splice(i,1);if(g.id!==groupId)origins.push(g.id);if(g.activeChild===blockId)setActive(g,g.children[0]??null)}}const at=Math.max(0,Math.min(group.children.length,index));group.children.splice(at,0,blockId);setActive(group,blockId);block.parentId=groupId;for(const id of origins)this.removeGroupIfEmpty(id);const home=this.returnStates.get(blockId);const stableParent=group.meta?.extractedBlock!==true&&group.posture!=='floating'&&group.posture!=='popout'&&group.posture!=='maximized';if(stableParent||home?.sourceGroupId===groupId)this.returnStates.delete(blockId);this.emit('block:move',{blockId,groupId,index:at});return blockId}
  /** @deprecated */ attachPanel(blockId:string,groupId:string,index=Infinity){return this.attachBlock(blockId,groupId,index)}
  activateBlock(blockId:string){for(const group of this.groups.values())if(group.children.includes(blockId)){setActive(group,blockId);this.focusGroup(group.id);this.emit('block:activate',{blockId,groupId:group.id});return true}return false}
  /** @deprecated */ activatePanel(blockId:string){return this.activateBlock(blockId)}
  getBlockGroup(blockId:string){for(const group of this.groups.values())if(group.children.includes(blockId))return group;return null}
  /** @deprecated */ getPanelGroup(blockId:string){return this.getBlockGroup(blockId)}
  reorderBlock(groupId:string,blockId:string,index:number){return this.transact('Reorder MetaBlock tab',()=>this.attachBlock(blockId,groupId,index))}
  reorderPanel(groupId:string,blockId:string,index:number){return this.reorderBlock(groupId,blockId,index)}
  moveBlock(blockId:string,targetGroupId:string,index=Infinity){return this.transact('Move MetaBlock',()=>this.attachBlock(blockId,targetGroupId,index))}
  movePanel(blockId:string,targetGroupId:string,index=Infinity){return this.moveBlock(blockId,targetGroupId,index)}
  mergeBlock(blockId:string,targetGroupId:string,{index=Infinity}:{index?:number}={}){return this.moveBlock(blockId,targetGroupId,index)}
  mergePanel(blockId:string,targetGroupId:string,opts:{index?:number}={}){return this.mergeBlock(blockId,targetGroupId,opts)}

  private captureReturnState(blockId:string){
    if(this.returnStates.has(blockId))return this.returnStates.get(blockId)!;
    const source=this.getBlockGroup(blockId);if(!source)return null;
    const sourceIndex=source.children.indexOf(blockId);
    const sourceGroup:MetaBlockReturnState['sourceGroup']={
      id:source.id,title:source.title,role:source.role,icon:source.icon,meta:clone(source.meta),capabilities:clone(source.capabilities),parentId:source.parentId,
      posture:source.posture,lockedFullscreen:source.lockedFullscreen
    };
    const sourceSpatial=this.spatialRecord(source.id);
    const state:MetaBlockReturnState={blockId,sourceGroupId:source.id,sourceIndex,sourceGroup,sourceSpatial:sourceSpatial?clone(sourceSpatial):null};
    this.returnStates.set(blockId,state);this.emit('block:return-state',{blockId,state:clone(state)});return state;
  }

  /** Returns the remembered dock/group destination for a detached MetaBlock, if one exists. */
  getBlockReturnState(blockId:string){const state=this.returnStates.get(blockId);return state?clone(state):null}

  /** Semantic relationship state for menus, agents and adaptive interaction. */
  getBlockRelationshipContext(blockId:string):MetaBlockRelationshipContext|null{
    const block=this.blocks.get(blockId);if(!block||this.groups.has(blockId))return null;
    const parent=this.getBlockGroup(blockId);if(!parent)return null;
    const home=this.getBlockReturnState(blockId);
    const siblings=parent.children.filter(id=>id!==blockId).map(id=>this.blocks.get(id)).filter(Boolean) as MetaBlockInstance[];
    return{blockId,groupId:parent.id,posture:parent.posture,parent:clone(parent),home,siblings,isGrouped:parent.children.length>1,isDetached:Boolean(parent.meta?.extractedBlock)||parent.posture==='floating'||parent.posture==='popout'||parent.posture==='maximized',isDockChild:parent.role==='dock'&&!parent.meta?.extractedBlock,canReturnHome:Boolean(home&&home.sourceGroupId!==parent.id)||Boolean(home&&parent.meta?.extractedBlock),};
  }

  getParentMetaBlock(blockId:string){const group=this.getBlockGroup(blockId);return group?clone(group):null}
  getSiblingMetaBlocks(blockId:string){const group=this.getBlockGroup(blockId);return group?group.children.filter(id=>id!==blockId).map(id=>this.blocks.get(id)).filter(Boolean).map(v=>clone(v as MetaBlockInstance)):[]}

  /** Reattach a detached MetaBlock to the exact group/tab position it came from. */
  returnBlock(blockId:string){return this.transact('Return MetaBlock',()=>{
    const state=this.returnStates.get(blockId);if(!state||!this.blocks.has(blockId))return false;
    let target=this.groups.get(state.sourceGroupId);
    const owner=this.getBlockGroup(blockId);
    if(!target){
      const g=state.sourceGroup;
      this.createGroup({id:g.id,title:g.title,role:g.role,icon:g.icon,parentId:g.parentId,posture:g.posture,lockedFullscreen:g.lockedFullscreen,meta:clone(g.meta),capabilities:clone(g.capabilities),children:[]});
      target=this.groups.get(g.id)??null as any;
      if(target&&state.sourceSpatial)this.restoreSpatialRecord(target.id,state.sourceSpatial);
    }else if(owner?.id===target.id&&target.meta?.extractedBlock){
      // A one-child source may have been reused as the floating surface. Restore its original
      // dock/group identity and spatial record before returning the child in-place.
      const g=state.sourceGroup;
      target.title=g.title;target.role=g.role;target.icon=g.icon;target.parentId=g.parentId;target.meta=clone(g.meta);target.capabilities=clone(g.capabilities);target.lockedFullscreen=g.lockedFullscreen;target.posture=g.posture;
      this.layout=this.layout.filter(n=>n.groupId!==target!.id);this.floating.delete(target.id);this.popouts.delete(target.id);this.removeFromEdges(target.id);this.removeFromZones(target.id);
      if(state.sourceSpatial)this.restoreSpatialRecord(target.id,state.sourceSpatial);
    }
    if(!target)return false;
    this.attachBlock(blockId,target.id,state.sourceIndex);
    this.returnStates.delete(blockId);this.focusGroup(target.id);this.emit('block:return',{blockId,groupId:target.id,index:state.sourceIndex});return target.id
  })}

  extractBlock(blockId:string,{groupId=uid('group'),role,posture='floating',meta={}}:{groupId?:string;role?:string;posture?:string;meta?:Record<string,any>}={}):MetaBlockSpatialPlacement|false{
    const block=this.blocks.get(blockId),source=this.getBlockGroup(blockId);if(!block||this.groups.has(blockId)||block.capabilities.movable===false)return false;
    this.captureReturnState(blockId);
    // If the MetaBlock already owns its spatial surface, reuse that surface instead of creating wrappers.
    if(source&&source.children.length===1&&source.children[0]===blockId&&!source.lockedFullscreen&&!this.isPersistentContainer(source)){
      source.role=role??(block.role==='panel'?'panel':source.role);
      source.posture=posture;
      source.meta={...source.meta,...meta,extractedBlock:true,sourceGroupId:source.meta?.sourceGroupId??null};
      return{blockId,groupId:source.id,posture};
    }
    // Detached MetaBlocks must not inherit dock/group chrome metadata. The block keeps its identity; the new
    // spatial root gets only neutral detached metadata plus explicit overrides.
    this.createGroup({id:groupId,role:role??(block.role==='panel'?'panel':'group'),posture,meta:{extractedBlock:true,sourceGroupId:source?.id??null,...(block.meta?.detachedGroupMeta??{}),...meta},title:block.title});
    this.attachBlock(blockId,groupId);return{blockId,groupId,posture}
  }
  extractPanel(blockId:string,opts:{groupId?:string;role?:string;posture?:string;meta?:Record<string,any>}={}){const p=this.extractBlock(blockId,opts);return p?{...p,panelId:p.blockId}:false}
  floatBlock(blockId:string,bounds:FloatingBounds={x:80,y:80,width:380,height:300}){return this.transact('Float MetaBlock',()=>{const placement=this.extractBlock(blockId,{posture:'floating'});if(!placement)return false;this.floatGroupInternal(placement.groupId,bounds);this.emit('block:float',{blockId,groupId:placement.groupId,bounds});return placement.groupId})}
  floatPanel(blockId:string,bounds?:FloatingBounds){return this.floatBlock(blockId,bounds)}

  /** Keep a MetaBlock floating, but align it cleanly to a workspace edge. Snap is not Dock. */
  snapBlockToEdge(blockId:string,edge:Exclude<DockArea,'center'>,{workspaceWidth=1440,workspaceHeight=900,gap=8,bounds}:{workspaceWidth?:number;workspaceHeight?:number;gap?:number;bounds?:FloatingBounds}={}){return this.transact('Snap MetaBlock to edge',()=>{
    let group=this.getBlockGroup(blockId);if(!group||group.children.length!==1||group.children[0]!==blockId||group.lockedFullscreen){const placement=this.extractBlock(blockId,{posture:'floating'});if(!placement)return false;group=this.groups.get(placement.groupId)??null}
    if(!group)return false;
    const current=bounds??this.floating.get(group.id)??{x:80,y:80,width:400,height:320};
    const next={...current};
    if(edge==='left')next.x=gap;else if(edge==='right')next.x=Math.max(gap,workspaceWidth-current.width-gap);else if(edge==='top')next.y=gap;else next.y=Math.max(gap,workspaceHeight-current.height-gap);
    this.floatGroupInternal(group.id,next);this.emit('block:snap',{blockId,groupId:group.id,edge,bounds:clone(next)});return group.id
  })}
  /** Align a spatial MetaBlock group to an edge without changing it into a structural dock. */
  snapGroupToEdge(groupId:string,edge:Exclude<DockArea,'center'>,{workspaceWidth=1440,workspaceHeight=900,gap=8,bounds}:{workspaceWidth?:number;workspaceHeight?:number;gap?:number;bounds?:FloatingBounds}={}){return this.transact('Snap MetaBlock group to edge',()=>{
    const group=this.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.floatable===false)return false;
    const current=bounds??this.floating.get(group.id)??{x:80,y:80,width:400,height:320};const next={...current};
    if(edge==='left')next.x=gap;else if(edge==='right')next.x=Math.max(gap,workspaceWidth-current.width-gap);else if(edge==='top')next.y=gap;else next.y=Math.max(gap,workspaceHeight-current.height-gap);
    this.floatGroupInternal(group.id,next);this.emit('group:snap',{groupId:group.id,edge,bounds:clone(next)});return group.id
  })}
  dockBlock(blockId:string,{area='right',targetGroupId=null,size=.28,order=Infinity}:{area?:DockArea;targetGroupId?:string|null;size?:number;order?:number}={}){return this.transact('Dock MetaBlock',()=>{const target=targetGroupId?this.groups.get(targetGroupId):null;if(area==='center'){if(target){this.attachBlock(blockId,target.id);this.emit('block:dock',{blockId,groupId:target.id,area:'center'});return target.id}return false}const placement=this.extractBlock(blockId,{posture:'docked'});if(!placement)return false;const docked=this.dockGroupInternal(placement.groupId,{area,targetGroupId,size,order});if(!docked)return false;this.emit('block:dock',{blockId,groupId:placement.groupId,area,targetGroupId});return placement.groupId})}
  dockPanel(blockId:string,opts:{area?:DockArea;targetGroupId?:string|null;size?:number;order?:number}={}){return this.dockBlock(blockId,opts)}
  splitBlock(blockId:string,targetGroupId:string,area:DockArea='right',size=.35){return this.dockBlock(blockId,{targetGroupId,area,size})}
  splitPanel(blockId:string,targetGroupId:string,area:DockArea='right',size=.35){return this.splitBlock(blockId,targetGroupId,area,size)}

  /** Pin a single MetaBlock by promoting/reusing its spatial root. */
  pinBlock(blockId:string,{edge='right',size=.24,autoHide=false}:{edge?:Exclude<DockArea,'center'>;size?:number;autoHide?:boolean}={}){return this.transact(autoHide?'Auto-hide MetaBlock':'Pin MetaBlock',()=>{const placement=this.extractBlock(blockId,{posture:autoHide?'auto-hide':'pinned'});if(!placement)return false;return this.pinGroupInternal(placement.groupId,{edge,size,autoHide})?placement.groupId:false})}
  /** Pop a single MetaBlock into its own spatial root/window record. */
  popoutBlock(blockId:string,bounds:FloatingBounds={x:120,y:120,width:640,height:480}){return this.transact('Popout MetaBlock',()=>{const placement=this.extractBlock(blockId,{posture:'popout'});if(!placement)return false;return this.popoutGroupInternal(placement.groupId,bounds)?placement.groupId:false})}
  maximizeBlock(blockId:string){return this.transact('Maximize MetaBlock',()=>{
    const block=this.blocks.get(blockId),owner=this.getBlockGroup(blockId);if(!block||!owner||owner.lockedFullscreen||block.capabilities.maximizable===false)return false;
    let group=owner;
    // Maximizing a child of a dock/group must maximize that child, never the whole parent container.
    if(owner.children.length>1||this.isPersistentContainer(owner)){const placement=this.extractBlock(blockId,{posture:'floating',meta:{maximizeReturnHome:true}});if(!placement)return false;group=this.groups.get(placement.groupId)??owner;group.meta.maximizeReturnHome=true}
    if(group.posture==='maximized')return group.id;
    group.meta.restorePosture=group.posture;group.meta.restoreSpatial=this.spatialRecord(group.id);group.meta.maximizedBlockId=blockId;group.posture='maximized';this.emit('group:maximize',{groupId:group.id,blockId});return group.id
  })}
  restoreBlock(blockId:string){const group=this.getBlockGroup(blockId);if(!group||group.lockedFullscreen)return false;if(group.posture!=='maximized')return this.restoreGroup(group.id);const returnHome=Boolean(group.meta?.maximizeReturnHome&&this.returnStates.has(blockId));if(returnHome){delete group.meta.maximizeReturnHome;delete group.meta.maximizedBlockId;return this.returnBlock(blockId)}return this.restoreGroup(group.id)}

  mergeGroups(sourceId:string,targetId:string,{index=Infinity}:{index?:number}={}){return this.transact('Merge MetaBlock groups',()=>{const source=this.groups.get(sourceId),target=this.groups.get(targetId);if(!source||!target||source===target||source.lockedFullscreen||target.lockedFullscreen)return false;let at=index;for(const blockId of [...source.children]){this.attachBlock(blockId,targetId,at);if(Number.isFinite(at))at++}this.removeGroup(sourceId);this.focusGroup(targetId);this.emit('group:merge',{sourceId,targetId});return true})}

  private dockGroupInternal(groupId:string,{area='right',targetGroupId=null,size=.28,order=Infinity}:{area?:DockArea;targetGroupId?:string|null;size?:number;order?:number}={}){
    const group=this.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.dockable===false)return false;
    // Root-center docking is reserved for explicit root/workspace surfaces. A detached panel must never
    // become a fullscreen center pane simply because it lost a target during drag/restore.
    if(area==='center'&&!targetGroupId&&!this.allowsRootCenter(group))return false;
    group.posture='docked';this.floating.delete(groupId);this.popouts.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);this.layout=this.layout.filter(n=>n.groupId!==groupId);const node:LayoutNode={id:uid('layout'),groupId,area,targetGroupId,size:Math.max(.05,Math.min(.95,size)),order:Number.isFinite(order)?order:this.layout.length};this.layout.push(node);this.emit('group:dock',node);return true
  }
  dockGroup(groupId:string,opts:{area?:DockArea;targetGroupId?:string|null;size?:number;order?:number}={}){return this.transact('Dock group MetaBlock',()=>this.dockGroupInternal(groupId,opts))}
  splitGroup(sourceGroupId:string,targetGroupId:string,area:DockArea='right',size=.35){return this.dockGroup(sourceGroupId,{targetGroupId,area,size})}
  private floatGroupInternal(groupId:string,bounds:FloatingBounds={x:80,y:80,width:340,height:280}){const group=this.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.floatable===false)return false;group.posture='floating';this.layout=this.layout.filter(n=>n.groupId!==groupId);this.popouts.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);this.floating.set(groupId,{...bounds,z:this.nextZ()});this.focusGroup(groupId);this.emit('group:float',{groupId,bounds:this.floating.get(groupId)});return true}
  floatGroup(groupId:string,bounds:FloatingBounds={x:80,y:80,width:340,height:280}){return this.transact('Float group MetaBlock',()=>this.floatGroupInternal(groupId,bounds))}
  setFloatingBounds(groupId:string,bounds:Partial<FloatingBounds>,{history=false}:{history?:boolean}={}){const current=this.floating.get(groupId);if(!current)return false;const apply=()=>{Object.assign(current,bounds);this.emit('floating:bounds',{groupId,bounds:{...current}});return true};return history?this.transact('Move floating MetaBlock',apply):apply()}
  setGroupVisibility(groupId:string,visible=true){const group=this.groups.get(groupId);if(!group)return false;group.meta={...group.meta,visible:Boolean(visible)};this.emit('group:visibility',{groupId,visible:Boolean(visible)});return true}
  resizeDockedGroup(groupId:string,size:number,{history=true}:{history?:boolean}={}){const group=this.groups.get(groupId);if(group?.lockedFullscreen)return false;const node=this.layout.find(n=>n.groupId===groupId);if(!node)return false;const apply=()=>{node.size=Math.max(.05,Math.min(.95,Number(size)));this.emit('layout:resize',{groupId,size:node.size});return true};return history?this.transact('Resize docked MetaBlock',apply):apply()}
  setGroupRole(groupId:string,role:string){const group=this.groups.get(groupId);if(!group)return false;group.role=role;this.emit('group:role',{groupId,role});return true}
  setGroupMeta(groupId:string,patch:Record<string,any>={}){const group=this.groups.get(groupId);if(!group)return false;group.meta={...group.meta,...patch};this.emit('group:meta',{groupId,meta:{...group.meta}});return true}
  setLayout(nodes:LayoutNode[]=[],{history=false,label='Set layout'}:{history?:boolean;label?:string}={}){const apply=()=>{this.layout=clone(nodes).filter(n=>!this.groups.get(n.groupId)?.lockedFullscreen);this.emit('layout:change',{layout:clone(this.layout)});return true};return history?this.transact(label,apply):apply()}

  private pinGroupInternal(groupId:string,{edge='right',size=.24,autoHide=false}:{edge?:Exclude<DockArea,'center'>;size?:number;autoHide?:boolean}={}){const group=this.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.pinable===false)return false;this.layout=this.layout.filter(n=>n.groupId!==groupId);this.floating.delete(groupId);this.popouts.delete(groupId);this.removeFromZones(groupId);this.removeFromEdges(groupId);group.posture=autoHide?'auto-hide':'pinned';const record:EdgeSurface={groupId,edge,size,autoHide};this.edgeSurfaces.set(groupId,record);this.emit('group:pin',record);return true}
  pinGroup(groupId:string,opts:{edge?:Exclude<DockArea,'center'>;size?:number;autoHide?:boolean}={}){return this.transact(opts.autoHide?'Auto-hide MetaBlock':'Pin MetaBlock',()=>this.pinGroupInternal(groupId,opts))}
  unpinGroup(groupId:string,{to='docked'}:{to?:'docked'|'floating'}={}){if(!this.edgeSurfaces.has(groupId))return false;return to==='floating'?this.floatGroup(groupId):this.dockGroup(groupId,{area:'right'})}
  private popoutGroupInternal(groupId:string,bounds:FloatingBounds={x:120,y:120,width:640,height:480}){const group=this.groups.get(groupId);if(!group||group.lockedFullscreen||group.capabilities.popoutable===false)return false;this.layout=this.layout.filter(n=>n.groupId!==groupId);this.floating.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);group.posture='popout';const record:PopoutRecord={groupId,bounds:{...bounds},windowId:uid('window'),open:true};this.popouts.set(groupId,record);this.emit('group:popout',record);return record}
  popoutGroup(groupId:string,bounds:FloatingBounds={x:120,y:120,width:640,height:480}){return this.transact('Popout MetaBlock',()=>this.popoutGroupInternal(groupId,bounds))}
  reattachPopout(groupId:string,{area='right',targetGroupId=null,size=.28}:{area?:DockArea;targetGroupId?:string|null;size?:number}={}){if(!this.popouts.has(groupId))return false;return this.dockGroup(groupId,{area,targetGroupId,size})}

  createWorkspaceZone({id=uid('zone'),bounds={x:0,y:0,width:1,height:1,unit:'relative'},modes=['overlay','floating','bottom-dock','right-dock','left-dock'],adaptive={},clip=true,layout='cascade',meta={}}:Partial<WorkspaceZone>&{id?:string}={}){if(this.zones.has(id))return id;this.zones.set(id,{id,bounds:{x:bounds.x??0,y:bounds.y??0,width:bounds.width??1,height:bounds.height??1,unit:bounds.unit??'relative'},modes:[...(modes??[])],adaptive:{...adaptive},clip:clip??true,layout:layout??'cascade',meta:{...meta},groups:[],modeByGroup:{}});this.emit('zone:add',{zone:this.zones.get(id)});return id}
  removeWorkspaceZone(zoneId:string){return this.transact('Remove workspace zone',()=>{const zone=this.zones.get(zoneId);if(!zone)return false;this.zones.delete(zoneId);this.emit('zone:remove',{zoneId});return true})}
  placeGroupInZone(groupId:string,zoneId:string,{mode='auto'}:{mode?:ZoneMode}={}){return this.transact('Place MetaBlock in zone',()=>{const group=this.groups.get(groupId),zone=this.zones.get(zoneId);if(!group||!zone||group.lockedFullscreen)return false;this.layout=this.layout.filter(n=>n.groupId!==groupId);this.floating.delete(groupId);this.popouts.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);if(!zone.groups.includes(groupId))zone.groups.push(groupId);zone.modeByGroup[groupId]=mode;group.posture='zone';group.meta.zoneId=zoneId;this.emit('zone:place',{groupId,zoneId,mode});return true})}
  setZoneMode(groupId:string,mode:ZoneMode){for(const zone of this.zones.values())if(zone.groups.includes(groupId)){if(mode!=='auto'&&!zone.modes.includes(mode))return false;zone.modeByGroup[groupId]=mode;this.emit('zone:mode',{groupId,zoneId:zone.id,mode});return true}return false}

  connectGroups(sourceId:string,targetId:string,{edge='right',gap=0,kind='snap'}:{edge?:string;gap?:number;kind?:string}={}){const id=[sourceId,targetId].sort().join('::');this.connections.set(id,{id,sourceId,targetId,edge,gap,kind});this.emit('group:connect',this.connections.get(id));return id}
  disconnectGroups(sourceId:string,targetId:string){const id=[sourceId,targetId].sort().join('::'),ok=this.connections.delete(id);if(ok)this.emit('group:disconnect',{sourceId,targetId});return ok}
  focusGroup(groupId:string){if(!this.groups.has(groupId))return false;this.focusedGroup=groupId;const f=this.floating.get(groupId);if(f)f.z=this.nextZ();this.emit('focus',{groupId});return true}
  selectGroup(groupId:string|null,{add=false}:{add?:boolean}={}){if(!add)this.selectedGroups.clear();if(groupId&&this.groups.has(groupId))this.selectedGroups.add(groupId);this.emit('selection',{groups:[...this.selectedGroups]});return[...this.selectedGroups]}
  maximizeGroup(groupId:string){return this.transact('Maximize MetaBlock',()=>{const g=this.groups.get(groupId);if(!g||g.lockedFullscreen||g.capabilities.maximizable===false)return false;g.meta.restorePosture=g.posture;g.meta.restoreSpatial=this.spatialRecord(groupId);g.posture='maximized';this.emit('group:maximize',{groupId});return true})}
  restoreGroup(groupId:string){return this.transact('Restore MetaBlock',()=>{const g=this.groups.get(groupId);if(!g||g.lockedFullscreen)return false;const restore=g.meta.restoreSpatial;g.posture=g.meta.restorePosture??'docked';delete g.meta.restorePosture;delete g.meta.restoreSpatial;if(restore?.kind==='floating')this.floating.set(groupId,restore.value);if(restore?.kind==='edge')this.edgeSurfaces.set(groupId,restore.value);if(restore?.kind==='layout')this.layout.push(restore.value);this.emit('group:restore',{groupId});return true})}

  undo(){const entry=this.undoStack.pop();if(!entry)return false;this.redoStack.push(entry);this.restore(entry.before,{preserveHistory:true});this.emit('history:undo',{label:entry.label});return true}
  redo(){const entry=this.redoStack.pop();if(!entry)return false;this.undoStack.push(entry);this.restore(entry.after,{preserveHistory:true});this.emit('history:redo',{label:entry.label});return true}
  serialize():WorkspaceSnapshot{return{version:this.version,id:this.id,blocks:[...this.blocks.values()].filter(v=>!this.groups.has(v.id)),groups:[...this.groups.values()],layout:clone(this.layout),floating:[...this.floating.entries()],popouts:[...this.popouts.entries()],edgeSurfaces:[...this.edgeSurfaces.entries()],zones:[...this.zones.entries()],connections:[...this.connections.entries()],returnStates:[...this.returnStates.entries()],focusedGroup:this.focusedGroup,selectedGroups:[...this.selectedGroups]}}
  restore(snapshot:Partial<WorkspaceSnapshot>|null|undefined,{preserveHistory=false}:{preserveHistory?:boolean}={}){if(!snapshot)return;this.id=snapshot.id??this.id;this.blocks=new Map(((snapshot.blocks??snapshot.panels??[]) as MetaBlockInstance[]).map(v=>[v.id,{...v,parentId:v.parentId??null}]));this.groups=new Map();for(const raw of snapshot.groups??[]){const g=normalizeGroup(raw as MetaBlockGroup);this.groups.set(g.id,g);this.blocks.set(g.id,g);for(const childId of g.children){const child=this.blocks.get(childId);if(child)child.parentId=g.id}}this.layout=clone(snapshot.layout??[]).filter(n=>!this.groups.get(n.groupId)?.lockedFullscreen);this.floating=new Map(snapshot.floating??[]);this.popouts=new Map(snapshot.popouts??[]);this.edgeSurfaces=new Map(snapshot.edgeSurfaces??[]);this.zones=new Map(snapshot.zones??[]);this.connections=new Map(snapshot.connections??[]);this.returnStates=new Map(snapshot.returnStates??[]);this.focusedGroup=snapshot.focusedGroup??null;this.selectedGroups=new Set(snapshot.selectedGroups??[]);if(!preserveHistory){this.undoStack.length=0;this.redoStack.length=0}this.repairSpatialState();this.emit('restore',{snapshot})}

  /**
   * Repair stale/legacy spatial state without app-specific knowledge. In particular, an extracted
   * panel stored as a root `center` dock is converted back to a bounded floating surface instead
   * of occupying the entire viewport. Persistent docks/workspaces are never changed here.
   */
  repairSpatialState({workspaceWidth=1440,workspaceHeight=900,gap=12}:{workspaceWidth?:number;workspaceHeight?:number;gap?:number}={}){
    let changed=false,cascade=0;
    // Persistent docks can declare their canonical zone. This is a package-level invariant, not app
    // bookkeeping: the dock stays a dock while its child MetaBlocks detach and return.
    for(const group of this.groups.values()){
      const zoneId=String(group.meta?.homeZoneId??'');if(group.role!=='dock'||!zoneId||group.meta?.lockHomeZone===false)continue;
      const zone=this.zones.get(zoneId);if(!zone)continue;const already=zone.groups.includes(group.id);if(already)continue;
      this.layout=this.layout.filter(n=>n.groupId!==group.id);this.floating.delete(group.id);this.popouts.delete(group.id);this.removeFromEdges(group.id);this.removeFromZones(group.id);
      if(!zone.groups.includes(group.id))zone.groups.push(group.id);zone.modeByGroup[group.id]=group.meta?.homeZoneMode??'bottom-dock';group.posture='zone';group.meta.zoneId=zoneId;changed=true;
      this.emit('group:repair',{groupId:group.id,reason:'restore-home-zone',zoneId,mode:zone.modeByGroup[group.id]});
    }
    for(const group of this.groups.values()){
      if(group.lockedFullscreen||this.isPersistentContainer(group))continue;
      const node=this.layout.find(n=>n.groupId===group.id);
      const invalidRootCenter=group.posture==='docked'&&node?.area==='center'&&!node.targetGroupId&&!this.allowsRootCenter(group)&&(group.role==='panel'||group.meta?.extractedBlock===true);
      if(!invalidRootCenter)continue;
      this.layout=this.layout.filter(n=>n.groupId!==group.id);group.posture='floating';
      const child=this.blocks.get(group.children[0]??'');const pref=child?.meta?.preferredFloatingSize??child?.meta?.floatingSize??{};
      const width=Math.max(280,Math.min(Number(pref.width??420),Math.max(280,workspaceWidth-gap*2)));
      const height=Math.max(200,Math.min(Number(pref.height??340),Math.max(200,workspaceHeight-gap*2)));
      const x=Math.min(Math.max(gap,64+cascade*24),Math.max(gap,workspaceWidth-width-gap));
      const y=Math.min(Math.max(gap,64+cascade*22),Math.max(gap,workspaceHeight-height-gap));
      this.floating.set(group.id,{x,y,width,height,z:this.nextZ()});cascade++;changed=true;
      this.emit('group:repair',{groupId:group.id,reason:'invalid-root-center',bounds:this.floating.get(group.id)});
    }
    return changed
  }

  private nextZ(){return Math.max(0,...[...this.floating.values()].map(v=>v.z??0))+1}
  private removeFromEdges(groupId:string){this.edgeSurfaces.delete(groupId)}
  private removeFromZones(groupId:string){for(const zone of this.zones.values()){zone.groups=zone.groups.filter(id=>id!==groupId);delete zone.modeByGroup[groupId]}const g=this.groups.get(groupId);if(g?.meta)delete g.meta.zoneId}
  private isPersistentContainer(group:MetaBlockGroup){return group.lockedFullscreen||group.role==='dock'||group.role==='workspace'||group.meta?.persistentContainer===true}
  private allowsRootCenter(group:MetaBlockGroup){return group.lockedFullscreen||group.role==='workspace'||group.role==='viewport'||group.meta?.allowRootCenter===true||group.meta?.rootFill===true}
  private removeGroupIfEmpty(id:string){const g=this.groups.get(id);if(g&&!g.children.length&&!this.isPersistentContainer(g))this.removeGroup(id)}
  private removeGroup(id:string){const group=this.groups.get(id);if(group?.lockedFullscreen)return false;for(const childId of group?.children??[]){const child=this.blocks.get(childId);if(child?.parentId===id)child.parentId=null}
    const removedNode=this.layout.find(n=>n.groupId===id)??null;
    // Preserve descendants that were split relative to the removed surface. They inherit the removed surface's parent target.
    for(const node of this.layout)if(node.targetGroupId===id)node.targetGroupId=removedNode?.targetGroupId??null;
    this.groups.delete(id);this.blocks.delete(id);this.layout=this.layout.filter(n=>n.groupId!==id);this.floating.delete(id);this.popouts.delete(id);this.edgeSurfaces.delete(id);this.removeFromZones(id);for(const[cid,c]of[...this.connections])if(c.sourceId===id||c.targetId===id)this.connections.delete(cid);this.emit('group:remove',{groupId:id});this.emit('block:remove',{block:group});return true}
  private pruneEmptyGroups(){for(const[id,g]of[...this.groups])if(!g.children.length&&!this.isPersistentContainer(g))this.removeGroup(id)}
  private spatialRecord(groupId:string):any{if(this.floating.has(groupId))return{kind:'floating',value:clone(this.floating.get(groupId))};if(this.edgeSurfaces.has(groupId))return{kind:'edge',value:clone(this.edgeSurfaces.get(groupId))};if(this.popouts.has(groupId))return{kind:'popout',value:clone(this.popouts.get(groupId))};for(const zone of this.zones.values())if(zone.groups.includes(groupId))return{kind:'zone',value:{zoneId:zone.id,mode:zone.modeByGroup[groupId]??'auto'}};const layout=this.layout.find(n=>n.groupId===groupId);if(layout)return{kind:'layout',value:clone(layout)};return null}
  private restoreSpatialRecord(groupId:string,record:{kind:string;value:any}){if(!record)return false;const group=this.groups.get(groupId);if(!group)return false;if(record.kind==='floating'){this.floatGroupInternal(groupId,clone(record.value));return true}if(record.kind==='edge'){const edge=record.value as EdgeSurface;return this.pinGroupInternal(groupId,{edge:edge.edge,size:edge.size,autoHide:edge.autoHide})}if(record.kind==='layout'){const node=clone(record.value) as LayoutNode;return this.dockGroupInternal(groupId,{area:node.area,targetGroupId:node.targetGroupId,size:node.size,order:node.order})}if(record.kind==='zone'){const v=record.value,zone=this.zones.get(v?.zoneId);if(!zone||group.lockedFullscreen)return false;this.layout=this.layout.filter(n=>n.groupId!==groupId);this.floating.delete(groupId);this.popouts.delete(groupId);this.removeFromEdges(groupId);this.removeFromZones(groupId);if(!zone.groups.includes(groupId))zone.groups.push(groupId);zone.modeByGroup[groupId]=v.mode??'auto';group.posture='zone';group.meta.zoneId=zone.id;this.emit('zone:place',{groupId,zoneId:zone.id,mode:zone.modeByGroup[groupId]});return true}if(record.kind==='popout'){return Boolean(this.popoutGroupInternal(groupId,clone(record.value?.bounds??record.value)))}return false}
}
