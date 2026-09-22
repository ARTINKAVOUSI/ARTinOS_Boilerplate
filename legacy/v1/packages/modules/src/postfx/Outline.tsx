import { Effect, type EffectProps } from './effect'
export function Outline({id='outline',enabled=true,order=500,edgeThickness=1,edgeGlow=0,downSampleRatio=2}:EffectProps&{edgeThickness?:number;edgeGlow?:number;downSampleRatio?:number}){return <Effect id={id} type="outline" enabled={enabled} order={order} params={{edgeThickness,edgeGlow,downSampleRatio}}/>}
