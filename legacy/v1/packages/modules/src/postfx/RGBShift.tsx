import { Effect, type EffectProps as O } from './effect'
export function RGBShift({amount=.003,angle=0,...rest}:{amount?:number;angle?:number}&O){return <Effect type="rgbShift" params={{amount,angle}} {...rest}/>}
