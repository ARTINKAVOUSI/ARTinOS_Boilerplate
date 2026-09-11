import { Effect,type EffectProps as O } from './effect'
export function GaussianBlur({radius=3,sigma=2,...rest}:{radius?:number;sigma?:number}&O){return <Effect type="gaussianBlur" params={{radius,sigma}} {...rest}/>}
