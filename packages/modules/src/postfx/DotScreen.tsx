import { Effect, type EffectProps as O } from './effect'
export function DotScreen({angle=1.57,scale=1,...rest}:{angle?:number;scale?:number}&O){return <Effect type="dotScreen" params={{angle,scale}} {...rest}/>}
