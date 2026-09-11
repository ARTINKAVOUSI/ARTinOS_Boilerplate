import { Effect, type EffectProps as O } from './effect'
export function Transition({mix=0,...rest}:{mix?:number}&O){return <Effect type="transition" params={{mix}} {...rest}/>}
