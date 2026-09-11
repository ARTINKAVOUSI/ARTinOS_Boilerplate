import { Effect, type EffectProps as O } from './effect'
export function Bloom({strength=1,radius=.25,threshold=.8,...rest}:{strength?:number;radius?:number;threshold?:number}&O){return <Effect type="bloom" params={{strength,radius,threshold}} {...rest}/>}
