import { Effect,type EffectProps as O } from './effect'
export function HashBlur({amount=.08,repeats=32,...rest}:{amount?:number;repeats?:number}&O){return <Effect type="hashBlur" params={{amount,repeats}} {...rest}/>}
