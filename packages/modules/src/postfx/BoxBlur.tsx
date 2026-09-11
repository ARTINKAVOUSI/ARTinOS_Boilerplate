import { Effect, type EffectProps } from './effect'
export function BoxBlur({id='boxBlur',enabled=true,order=500,size=1,separation=1,premultipliedAlpha=false}:EffectProps&{size?:number;separation?:number;premultipliedAlpha?:boolean}){return <Effect id={id} type="boxBlur" enabled={enabled} order={order} params={{size,separation,premultipliedAlpha}}/>}
