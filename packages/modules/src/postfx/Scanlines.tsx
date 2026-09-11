import { Effect,type EffectProps as O } from './effect'
export function Scanlines({intensity=.3,count=240,speed=0,...rest}:{intensity?:number;count?:number;speed?:number}&O){return <Effect type="scanlines" params={{intensity,count,speed}} {...rest}/>}
