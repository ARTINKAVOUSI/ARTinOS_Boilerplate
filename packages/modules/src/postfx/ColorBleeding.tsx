import { Effect,type EffectProps as O } from './effect'
export function ColorBleeding({amount=.002,...rest}:{amount?:number}&O){return <Effect type="colorBleeding" params={{amount}} {...rest}/>}
