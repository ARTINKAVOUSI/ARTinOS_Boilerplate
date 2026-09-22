import { Effect,type EffectProps as O } from './effect'
export function Saturation({adjustment=1,...rest}:{adjustment?:number}&O){return <Effect type="saturation" params={{adjustment}} {...rest}/>}
