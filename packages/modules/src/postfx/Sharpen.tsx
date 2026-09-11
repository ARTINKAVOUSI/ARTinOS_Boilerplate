import { Effect,type EffectProps as O } from './effect'
export function Sharpen({sharpness=.35,denoise=false,...rest}:{sharpness?:number;denoise?:boolean}&O){return <Effect type="sharpen" params={{sharpness,denoise}} {...rest}/>}
