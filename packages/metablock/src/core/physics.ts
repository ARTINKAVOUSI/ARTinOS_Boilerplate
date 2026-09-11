import type { MetaBlockMotionConfig, Rect } from './types.js';

const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));

export interface MetaBlockKineticPose {
  translateX:number;
  translateY:number;
  rotate:number;
  scale:number;
  lift:number;
  energy:number;
  field:number;
}

export function kineticEnergy(speed:number,profile:string='physical'){
  const range=profile==='expressive'?1850:profile==='quiet'?2600:2200;
  return clamp(Math.abs(speed)/range,0,1);
}

/**
 * A very small visual attraction vector. Structural docking never depends on this offset.
 * The pointer/dragged rect remains authoritative, which keeps MetaBlock manipulation direct and stable.
 */
export function magneticOffset(source:Rect,target:Rect|null,strength:number,magnetism:number,maxOffset=2.25){
  if(!target||strength<=0||magnetism<=0)return{x:0,y:0};
  const sx=source.x+source.width/2,sy=source.y+source.height/2,tx=target.x+target.width/2,ty=target.y+target.height/2;
  const dx=tx-sx,dy=ty-sy,d=Math.max(1,Math.hypot(dx,dy)),amount=maxOffset*clamp(strength,0,1)*clamp(magnetism,0,1);
  return{x:dx/d*amount,y:dy/d*amount};
}

/**
 * MetaBlock pose is intentionally restrained: direct manipulation is 1:1 and the kinetic layer only
 * communicates lift, energy, field contact and a tiny directional attitude. This avoids floaty/jittery panels.
 */
export function resolveKineticPose({velocityX=0,velocityY=0,fieldStrength=0,magnet={x:0,y:0},motion}:{velocityX?:number;velocityY?:number;fieldStrength?:number;magnet?:{x:number;y:number};motion:MetaBlockMotionConfig}):MetaBlockKineticPose{
  const speed=Math.hypot(velocityX,velocityY),energy=kineticEnergy(speed,motion.profile),expressive=motion.profile==='expressive'?1.2:motion.profile==='quiet'?.35:1;
  const tiltLimit=Math.max(.05,motion.tilt*expressive);
  const tilt=clamp((velocityX/2200)*motion.tilt*expressive,-tiltLimit,tiltLimit);
  const field=clamp(fieldStrength,0,1);
  const scale=1+energy*.0014*expressive-field*motion.compression*.18;
  return{
    translateX:magnet.x,
    translateY:magnet.y,
    rotate:tilt,
    scale,
    lift:motion.lift*(.35+energy*.42+field*.18),
    energy,
    field
  };
}

export function resolveSettleDuration(motion:MetaBlockMotionConfig){
  const omega=Math.sqrt(Math.max(.0001,motion.stiffness/motion.mass)),ratio=springDampingRatio(motion),physical=(1000/omega)*(3.3+Math.min(2,ratio*1.6));
  const blended=motion.response*.72+physical*.28;
  if(motion.profile==='quiet')return Math.max(70,Math.min(170,blended*.72));
  if(motion.profile==='expressive')return Math.max(130,Math.min(300,blended*1.08));
  return Math.max(95,Math.min(240,blended));
}

export function resolveSettleCurve(motion:MetaBlockMotionConfig){
  const ratio=springDampingRatio(motion);
  if(motion.profile==='quiet'||ratio>1.05)return 'cubic-bezier(.2,.72,.2,1)';
  if(motion.profile==='expressive'&&ratio<.72)return 'cubic-bezier(.16,1.01,.24,1)';
  return 'cubic-bezier(.18,.9,.24,1)';
}

export function springDampingRatio(motion:MetaBlockMotionConfig){return motion.damping/(2*Math.sqrt(Math.max(.0001,motion.stiffness*motion.mass)))}
