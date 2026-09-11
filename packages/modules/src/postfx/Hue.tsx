import { Effect,type EffectProps as O } from './effect'
export function Hue({adjustment=0,...rest}:{adjustment?:number}&O){return <Effect type="hue" params={{adjustment}} {...rest}/>}
