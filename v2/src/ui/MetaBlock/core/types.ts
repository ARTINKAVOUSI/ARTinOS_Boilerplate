export type MetaBlockPosture = 'docked' | 'floating' | 'zone' | 'pinned' | 'auto-hide' | 'popout' | 'maximized' | 'fullscreen-locked' | string;
export type MetaBlockRole = 'workspace' | 'viewport' | 'dock' | 'group' | 'panel' | 'header' | 'tab' | 'toolbar' | 'sidebar' | 'overlay' | 'popout' | string;
export type DockArea = 'left' | 'right' | 'top' | 'bottom' | 'center';
export type ZoneMode = 'auto' | 'overlay' | 'floating' | 'bottom-dock' | 'right-dock' | 'left-dock' | 'top-dock' | string;

export interface MetaBlockCapabilities {
  closable: boolean;
  movable: boolean;
  resizable: boolean;
  floatable: boolean;
  dockable: boolean;
  splittable: boolean;
  tabbable: boolean;
  popoutable: boolean;
  maximizable: boolean;
  nestable: boolean;
  pinable: boolean;
  autoHideable: boolean;
  acceptsDrop: boolean;
  [key:string]: boolean;
}

/** Canonical ARTINOS spatial/content primitive. Panel, dock, tab, viewport and window are roles of MetaBlock. */
export interface MetaBlockInstance {
  id: string;
  title: string;
  role: MetaBlockRole;
  icon: string | null;
  meta: Record<string, any>;
  capabilities: MetaBlockCapabilities;
  parentId: string | null;
}

/**
 * A grouped/container MetaBlock. The canonical fields are children + activeChild.
 * panels/active remain compatibility aliases for older consumers and always mirror them.
 */
export interface MetaBlockGroup extends MetaBlockInstance {
  children: string[];
  activeChild: string | null;
  panels: string[];
  active: string | null;
  posture: MetaBlockPosture;
  lockedFullscreen: boolean;
}

/** @deprecated Panel is a MetaBlock role, not a separate primitive. */
export type MetaBlockPanel = MetaBlockInstance;

export interface LayoutNode {
  id: string;
  groupId: string;
  area: DockArea;
  targetGroupId: string | null;
  size: number;
  order: number;
}

export interface Rect { x:number; y:number; width:number; height:number; left?:number; top?:number; right?:number; bottom?:number }
export interface FloatingBounds { x:number; y:number; width:number; height:number; z?:number }
export interface PopoutRecord { groupId:string; bounds:FloatingBounds; windowId:string; open:boolean }
export interface EdgeSurface { groupId:string; edge:Exclude<DockArea,'center'>; size:number; autoHide:boolean }
export interface WorkspaceZone {
  id:string;
  bounds:{x:number;y:number;width:number;height:number;unit?:'relative'|'px'|string};
  modes:ZoneMode[];
  adaptive:Record<string,any>;
  clip:boolean;
  layout:string;
  meta:Record<string,any>;
  groups:string[];
  modeByGroup:Record<string,ZoneMode>;
}
export interface SpatialConnection { id:string; sourceId:string; targetId:string; edge:string; gap:number; kind:string }

export interface DockCandidate {
  kind:'workspace-edge'|'workspace-snap'|'merge'|'split'|string;
  area?:DockArea;
  targetId?:string;
  distance:number;
  strength:number;
  ratio?:number;
  intent?:string;
  relation?:'home'|'dock'|'group'|'workspace'|'snap'|string;
}

/**
 * Remember where a leaf MetaBlock came from before it was promoted into its own
 * floating/docked spatial surface. This lets a detached panel return to the exact
 * dock/group/tab index it came from instead of relying on app-specific bookkeeping.
 */
export interface MetaBlockReturnState {
  blockId:string;
  sourceGroupId:string;
  sourceIndex:number;
  sourceGroup:Omit<MetaBlockGroup,'children'|'activeChild'|'panels'|'active'>;
  sourceSpatial:{kind:'floating'|'edge'|'layout'|'zone'|'popout'|string;value:any}|null;
}


export interface MetaBlockRelationshipContext {
  blockId:string;
  groupId:string;
  posture:MetaBlockPosture;
  parent:MetaBlockGroup|null;
  home:MetaBlockReturnState|null;
  siblings:MetaBlockInstance[];
  isGrouped:boolean;
  isDetached:boolean;
  isDockChild:boolean;
  canReturnHome:boolean;
}

export interface MetaBlockSpatialPlacement {
  blockId:string;
  groupId:string;
  posture:MetaBlockPosture;
}
/** @deprecated */
export type PanelSpatialPlacement = MetaBlockSpatialPlacement;

export interface WorkspaceSnapshot {
  version:number;
  id:string;
  blocks:MetaBlockInstance[];
  /** Legacy migration input only. */
  panels?:MetaBlockInstance[];
  groups:MetaBlockGroup[];
  layout:LayoutNode[];
  floating:Array<[string,FloatingBounds]>;
  popouts:Array<[string,PopoutRecord]>;
  edgeSurfaces:Array<[string,EdgeSurface]>;
  zones:Array<[string,WorkspaceZone]>;
  connections:Array<[string,SpatialConnection]>;
  returnStates?:Array<[string,MetaBlockReturnState]>;
  focusedGroup:string|null;
  selectedGroups:string[];
}

export interface MetaBlockMotionConfig {
  profile:'quiet'|'physical'|'expressive'|string;
  stiffness:number;
  damping:number;
  mass:number;
  magnetism:number;
  inertia:number;
  response:number;
  compression:number;
  lift:number;
  tilt:number;
}

export const defaultMetaBlockMotionConfig:Readonly<MetaBlockMotionConfig>=Object.freeze({
  profile:'physical',
  stiffness:420,
  damping:44,
  mass:1,
  magnetism:.42,
  inertia:.035,
  response:135,
  compression:.004,
  lift:1.55,
  tilt:.10
});

export interface MetaBlockRuntimeConfig {
  gap:number;
  snap:number;
  dockRadius:number;
  dockRatio:number;
  splitRatio:number;
  hysteresis:number;
  intentHoldMs:number;
  previewStrength:number;
  commitStrength:number;
  blockDragThreshold:number;
  groupDragThreshold:number;
  showDockCompass:boolean;
  showSmartGuides:boolean;
  liveDocking:boolean;
  motion:MetaBlockMotionConfig;
}

export const defaultMetaBlockRuntimeConfig:Readonly<MetaBlockRuntimeConfig>=Object.freeze({
  gap:8,
  snap:14,
  dockRadius:64,
  dockRatio:.28,
  splitRatio:.36,
  hysteresis:.16,
  intentHoldMs:92,
  previewStrength:.30,
  commitStrength:.54,
  blockDragThreshold:7,
  groupDragThreshold:6,
  showDockCompass:true,
  showSmartGuides:true,
  liveDocking:true,
  motion:defaultMetaBlockMotionConfig
});

export type WorkspaceEvent = { type:string; payload:any };
