import { Effect, type EffectProps as O } from './effect'
export function BilateralBlur({sigma=2,sigmaColor=.1,...rest}:{sigma?:number;sigmaColor?:number}&O){return <Effect type="bilateralBlur" params={{sigma,sigmaColor}} {...rest}/>}
